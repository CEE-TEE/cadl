import { readdir } from "fs/promises";
import jsyaml from "js-yaml";
import Mustache from "mustache";
import prompts from "prompts";
import { CadlConfigFilename } from "../config/config-loader.js";
import { logDiagnostics } from "../core/diagnostics.js";
import { formatCadl } from "../core/formatter.js";
import { getBaseFileName, joinPaths } from "../core/path-utils.js";
import { createJSONSchemaValidator } from "../core/schema-validator.js";
import { CompilerHost, SourceFile } from "../core/types.js";
import { readUrlOrPath, resolveRelativeUrlOrPath } from "../core/util.js";
import { InitTemplate, InitTemplateDefinitionsSchema, InitTemplateFile } from "./init-template.js";

interface ScaffoldingConfig extends InitTemplate {
  /**
   * Path where this template was loaded from.
   */
  templateUri: string;

  /**
   * Directory where the project should be initialized.
   */
  directory: string;

  /**
   * Name of the project.
   */
  name: string;

  /**
   * List of libraries to include
   */
  libraries: string[];

  /**
   * Custom parameters provided in the tempalates.
   */
  parameters: Record<string, any>;
}

export async function initCadlProject(
  host: CompilerHost,
  directory: string,
  templatesUrl?: string
) {
  if (!(await confirmDirectoryEmpty(directory))) {
    return;
  }
  const folderName = getBaseFileName(directory);

  const template = await selectTemplate(host, templatesUrl);
  const { name } = await prompts([
    {
      type: "text",
      name: "name",
      message: `Project name`,
      initial: folderName,
    },
  ]);

  const libraries = await selectLibraries(template);
  const parameters = await promptCustomParameters(template);
  const scaffoldingConfig: ScaffoldingConfig = {
    ...template,
    templateUri: templatesUrl ?? ".",
    libraries,
    name,
    directory,
    parameters,
  };
  await scaffoldNewProject(host, scaffoldingConfig);
}

async function promptCustomParameters(template: InitTemplate): Promise<Record<string, any>> {
  if (!template.inputs) {
    return {};
  }

  const promptList = [...Object.entries(template.inputs)].map(([name, input]) => {
    return {
      name,
      type: input.type,
      message: input.description,
      initial: input.initialValue,
    };
  });
  return await prompts(promptList);
}

async function isDirectoryEmpty(directory: string) {
  try {
    const files = await readdir(directory);
    return files.length === 0;
  } catch {
    return true;
  }
}

async function confirmDirectoryEmpty(directory: string) {
  if (await isDirectoryEmpty(directory)) {
    return true;
  }

  return confirm(
    `Folder '${directory}' is not empty. Are you sure you want to initialize a new project here?`
  );
}

const builtInTemplates: Record<string, InitTemplate> = {
  empty: {
    title: "Empty project",
    description: "Create an empty project.",
    libraries: [],
  },
  rest: {
    title: "Generic Rest API",
    description: "Create a project representing a generic Rest API",
    libraries: ["@cadl-lang/rest", "@cadl-lang/openapi3"],
    config: {
      emitters: {
        "@cadl-lang/openapi3": true,
      },
    },
  },
};

async function confirm(message: string): Promise<boolean> {
  const { confirm } = await prompts({
    name: "confirm",
    type: "confirm",
    message,
    initial: true,
  });
  return confirm;
}

async function downloadTemplates(
  host: CompilerHost,
  templatesUrl: string
): Promise<Record<string, InitTemplate>> {
  const file = await readUrlOrPath(host, templatesUrl);

  const json = JSON.parse(file.text);
  validateTemplateDefinitions(host, json, file);
  return json;
}

async function selectTemplate(
  host: CompilerHost,
  templatesUrl: string | undefined
): Promise<InitTemplate> {
  const templates =
    templatesUrl === undefined ? builtInTemplates : await downloadTemplates(host, templatesUrl);
  return promptTemplateSelection(templates);
}

async function promptTemplateSelection(
  templates: Record<string, InitTemplate>
): Promise<InitTemplate> {
  const { templateName } = await prompts({
    type: "select",
    name: "templateName",
    message: "Please select a template",
    choices: Object.entries(templates).map(([id, template]) => {
      return { value: id, description: template.description, title: template.title };
    }),
  });
  const template = templates[templateName];
  if (!template) {
    throw new Error(`Unexpected error: Cannot find template ${templateName}`);
  }
  return template;
}

async function selectLibraries(template: InitTemplate): Promise<string[]> {
  if (template.libraries.length === 0) {
    return [];
  }

  const libraryChoices = template.libraries.map((x) => ({ name: x, description: "" }));

  const { libraries } = await prompts({
    type: "multiselect",
    name: "libraries",
    message: "Update the libraries?",
    choices: libraryChoices.map((x) => {
      return {
        title: x.name,
        description: x.description,
        value: x.name,
        selected: true,
      };
    }),
    initial: template.libraries as any,
  });

  return libraries;
}

export async function scaffoldNewProject(host: CompilerHost, config: ScaffoldingConfig) {
  await writePackageJson(host, config);
  await writeConfig(host, config);
  await writeMain(host, config);
  await writeFiles(host, config);

  // eslint-disable-next-line no-console
  console.log("Cadl init completed. You can run `cadl install` now to install dependencies.");
}

async function writePackageJson(host: CompilerHost, config: ScaffoldingConfig) {
  const dependencies: Record<string, string> = {
    "@cadl-lang/compiler": "latest",
  };

  for (const library of config.libraries) {
    dependencies[library] = "latest";
  }

  const packageJson = {
    name: config.name,
    dependencies,
    private: true,
  };

  return host.writeFile(
    joinPaths(config.directory, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
}

async function writeConfig(host: CompilerHost, config: ScaffoldingConfig) {
  if (!config.config) {
    return;
  }
  const content = jsyaml.dump(config.config);
  return host.writeFile(joinPaths(config.directory, CadlConfigFilename), content);
}

async function writeMain(host: CompilerHost, config: ScaffoldingConfig) {
  const dependencies: Record<string, string> = {};

  for (const library of config.libraries) {
    dependencies[library] = "latest";
  }

  const lines = [...config.libraries.map((x) => `import "${x}";`), ""];
  const content = lines.join("\n");

  return host.writeFile(joinPaths(config.directory, "main.cadl"), formatCadl(content));
}

async function writeFiles(host: CompilerHost, config: ScaffoldingConfig) {
  if (!config.files) {
    return;
  }
  for (const file of config.files) {
    await writeFile(host, config, file);
  }
}

async function writeFile(host: CompilerHost, config: ScaffoldingConfig, file: InitTemplateFile) {
  const template = await readUrlOrPath(
    host,
    resolveRelativeUrlOrPath(config.templateUri, file.path)
  );
  const content = Mustache.render(template.text, config);
  return host.writeFile(joinPaths(config.directory, file.destination), content);
}

function validateTemplateDefinitions(
  host: CompilerHost,
  templates: unknown,
  file: SourceFile
): asserts templates is Record<string, InitTemplate> {
  const validator = createJSONSchemaValidator(InitTemplateDefinitionsSchema);
  const diagnostics = validator.validate(templates, file);
  if (diagnostics.length > 0) {
    logDiagnostics(diagnostics, host.logSink);
    throw new Error("Template contained error.");
  }
}
