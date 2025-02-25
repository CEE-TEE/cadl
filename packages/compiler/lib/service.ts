import { createDecoratorDefinition, validateDecoratorTarget } from "../core/decorator-utils.js";
import { reportDeprecated } from "../core/index.js";
import { createDiagnostic, reportDiagnostic } from "../core/messages.js";
import { Program } from "../core/program.js";
import { DecoratorContext, Model, Namespace, Type } from "../core/types.js";

interface ServiceDetails {
  namespace?: Namespace;
  title?: string;
  version?: string;
  host?: string;
}

const serviceDetailsKey = Symbol.for("ServiceDetails");
function getServiceDetails(program: Program): ServiceDetails {
  const programServiceDetails = program.stateMap(serviceDetailsKey);
  const key = program.getGlobalNamespaceType();
  let serviceDetails = programServiceDetails.get(key);
  if (!serviceDetails) {
    serviceDetails = {};
    programServiceDetails.set(key, serviceDetails);
  }

  return serviceDetails;
}

export function setServiceNamespace(program: Program, namespace: Namespace): void {
  const serviceDetails = getServiceDetails(program);
  if (serviceDetails.namespace && serviceDetails.namespace !== namespace) {
    program.reportDiagnostic(
      createDiagnostic({ code: "service-namespace-duplicate", target: namespace })
    );
  }

  serviceDetails.namespace = namespace;
}

export function checkIfServiceNamespace(program: Program, namespace: Namespace): boolean {
  const serviceDetails = getServiceDetails(program);
  return serviceDetails.namespace === namespace;
}

const serviceDecorator = createDecoratorDefinition({
  name: "@service",
  target: "Namespace",
  args: [{ kind: "Model" }],
});
export function $service(context: DecoratorContext, target: Namespace, options: Model) {
  if (!serviceDecorator.validate(context, target, [options])) {
    return;
  }
  const serviceDetails = getServiceDetails(context.program);

  setServiceNamespace(context.program, target);

  const title = options.properties.get("title")?.type;
  const version = options.properties.get("version")?.type;
  if (title) {
    if (title.kind === "String") {
      serviceDetails.title = title.value;
    } else {
      reportDiagnostic(context.program, {
        code: "unassignable",
        format: { value: context.program.checker.getTypeName(title), targetType: "String" },
        target: context.getArgumentTarget(0)!,
      });
    }
  }
  if (version) {
    if (version.kind === "String") {
      serviceDetails.version = version.value;
    } else {
      reportDiagnostic(context.program, {
        code: "unassignable",
        format: { value: context.program.checker.getTypeName(version), targetType: "String" },
        target: context.getArgumentTarget(0)!,
      });
    }
  }
}

/**
 * @deprecated use `@service` instead
 */
export function $serviceTitle(context: DecoratorContext, target: Type, title: string) {
  reportDeprecated(
    context.program,
    "@serviceTitle decorator has been deprecated use @service({title: _}) instead.",
    context.decoratorTarget
  );
  const serviceDetails = getServiceDetails(context.program);
  if (!validateDecoratorTarget(context, target, "@serviceTitle", "Namespace")) {
    return;
  }

  setServiceNamespace(context.program, target);
  serviceDetails.title = title;
}

export function getServiceTitle(program: Program): string {
  const serviceDetails = getServiceDetails(program);
  return serviceDetails.title || "(title)";
}

/**
 * @deprecated use `@service` instead
 */
export function $serviceVersion(context: DecoratorContext, target: Type, version: string) {
  const serviceDetails = getServiceDetails(context.program);
  reportDeprecated(
    context.program,
    "@serviceVersion decorator has been deprecated use @service({title: _}) instead.",
    context.decoratorTarget
  );
  if (!validateDecoratorTarget(context, target, "@serviceVersion", "Namespace")) {
    return;
  }

  setServiceNamespace(context.program, target);
  serviceDetails.version = version;
}

export function getServiceVersion(program: Program): string {
  const serviceDetails = getServiceDetails(program);
  return serviceDetails.version || "0000-00-00";
}

export function getServiceNamespace(program: Program): Namespace {
  const serviceDetails = getServiceDetails(program);
  return serviceDetails.namespace ?? program.getGlobalNamespaceType();
}

export function getServiceNamespaceString(program: Program): string | undefined {
  const serviceDetails = getServiceDetails(program);
  return (
    (serviceDetails.namespace && program.checker.getNamespaceString(serviceDetails.namespace)) ||
    undefined
  );
}
