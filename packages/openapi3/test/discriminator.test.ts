import { expectDiagnostics } from "@cadl-lang/compiler/testing";
import { deepStrictEqual, ok } from "assert";
import { checkFor, createOpenAPITestRunner, openApiFor } from "./test-host.js";

describe("openapi3: discriminated unions", () => {
  it("emit diagnostics if not used on model or property", async () => {
    const runner = await createOpenAPITestRunner();
    const diagnostics = await runner.diagnose(`
      @discriminator("kind")
      namespace Foo {}
    `);
    expectDiagnostics(diagnostics, {
      code: "decorator-wrong-target",
      message: "Cannot apply @discriminator decorator to Namespace",
    });
  });

  it("defines unions with discriminators", async () => {
    const openApi = await openApiFor(`
      @discriminator("kind")
      model Pet { }
      model Cat extends Pet {
        kind: "cat";
        meow: int32;
      }
      model Dog extends Pet {
        kind: "dog";
        bark: string;
      }

      op read(): { @body body: Pet };
      `);
    ok(openApi.components.schemas.Pet, "expected definition named Pet");
    ok(openApi.components.schemas.Cat, "expected definition named Cat");
    ok(openApi.components.schemas.Dog, "expected definition named Dog");
    deepStrictEqual(openApi.paths["/"].get.responses["200"].content["application/json"].schema, {
      $ref: "#/components/schemas/Pet",
    });
    deepStrictEqual(openApi.components.schemas.Pet, {
      type: "object",
      properties: {
        kind: {
          type: "string",
          description: "Discriminator property for Pet.",
        },
      },
      discriminator: {
        propertyName: "kind",
        mapping: {
          cat: "#/components/schemas/Cat",
          dog: "#/components/schemas/Dog",
        },
      },
    });
    deepStrictEqual(openApi.components.schemas.Cat.allOf, [{ $ref: "#/components/schemas/Pet" }]);
    deepStrictEqual(openApi.components.schemas.Dog.allOf, [{ $ref: "#/components/schemas/Pet" }]);
  });

  it("defines discriminated unions with non-empty base type", async () => {
    const openApi = await openApiFor(`
      @discriminator("kind")
      model Pet {
        name: string;
        weight?: float32;
      }
      model Cat extends Pet {
        kind: "cat";
        meow: int32;
      }
      model Dog extends Pet {
        kind: "dog";
        bark: string;
      }

      op read(): { @body body: Pet };
      `);
    ok(openApi.components.schemas.Pet, "expected definition named Pet");
    ok(openApi.components.schemas.Cat, "expected definition named Cat");
    ok(openApi.components.schemas.Dog, "expected definition named Dog");
    deepStrictEqual(openApi.paths["/"].get.responses["200"].content["application/json"].schema, {
      $ref: "#/components/schemas/Pet",
    });
    deepStrictEqual(openApi.components.schemas.Pet, {
      type: "object",
      properties: {
        kind: {
          type: "string",
          description: "Discriminator property for Pet.",
        },
        name: { type: "string" },
        weight: { type: "number", format: "float" },
      },
      required: ["name"],
      discriminator: {
        propertyName: "kind",
        mapping: {
          cat: "#/components/schemas/Cat",
          dog: "#/components/schemas/Dog",
        },
      },
    });
    deepStrictEqual(openApi.components.schemas.Cat.allOf, [{ $ref: "#/components/schemas/Pet" }]);
    deepStrictEqual(openApi.components.schemas.Dog.allOf, [{ $ref: "#/components/schemas/Pet" }]);
  });

  it("defines discriminated unions with more than one level of inheritance", async () => {
    const openApi = await openApiFor(`
      @discriminator("kind")
      model Pet {
        name: string;
        weight?: float32;
      }
      model Cat extends Pet {
        kind: "cat";
        meow: int32;
      }
      model Dog extends Pet {
        kind: "dog";
        bark: string;
      }
      model Beagle extends Dog {
        purebred: boolean;
      }

      op read(): { @body body: Pet };
      `);
    ok(openApi.components.schemas.Pet, "expected definition named Pet");
    ok(openApi.components.schemas.Cat, "expected definition named Cat");
    ok(openApi.components.schemas.Dog, "expected definition named Dog");
    ok(openApi.components.schemas.Beagle, "expected definition named Beagle");
    deepStrictEqual(openApi.paths["/"].get.responses["200"].content["application/json"].schema, {
      $ref: "#/components/schemas/Pet",
    });
    deepStrictEqual(openApi.components.schemas.Pet, {
      type: "object",
      properties: {
        name: { type: "string" },
        kind: {
          type: "string",
          description: "Discriminator property for Pet.",
        },
        weight: { type: "number", format: "float" },
      },
      required: ["name"],
      discriminator: {
        propertyName: "kind",
        mapping: {
          cat: "#/components/schemas/Cat",
          dog: "#/components/schemas/Dog",
        },
      },
    });
    deepStrictEqual(openApi.components.schemas.Cat.allOf, [{ $ref: "#/components/schemas/Pet" }]);
    deepStrictEqual(openApi.components.schemas.Dog.allOf, [{ $ref: "#/components/schemas/Pet" }]);
    deepStrictEqual(openApi.components.schemas.Beagle.allOf, [
      { $ref: "#/components/schemas/Dog" },
    ]);
  });

  it("defines nested discriminated unions", async () => {
    const openApi = await openApiFor(`
      @discriminator("kind")
      model Pet {
        name: string;
        weight?: float32;
      }
      model Cat extends Pet {
        kind: "cat";
        meow: int32;
      }
      @discriminator("breed")
      model Dog extends Pet {
        kind: "dog";
        bark: string;
      }
      #suppress "@cadl-lang/openapi3/discriminator-value" "kind defined in parent"
      model Beagle extends Dog {
        breed: "beagle";
      }
      #suppress "@cadl-lang/openapi3/discriminator-value" "kind defined in parent"
      model Poodle extends Dog {
        breed: "poodle";
      }

      op read(): { @body body: Pet };
      `);
    ok(openApi.components.schemas.Pet, "expected definition named Pet");
    ok(openApi.components.schemas.Cat, "expected definition named Cat");
    ok(openApi.components.schemas.Dog, "expected definition named Dog");
    ok(openApi.components.schemas.Beagle, "expected definition named Beagle");
    ok(openApi.components.schemas.Poodle, "expected definition named Poodle");
    deepStrictEqual(openApi.paths["/"].get.responses["200"].content["application/json"].schema, {
      $ref: "#/components/schemas/Pet",
    });
    deepStrictEqual(openApi.components.schemas.Pet, {
      type: "object",
      properties: {
        kind: {
          type: "string",
          description: "Discriminator property for Pet.",
        },
        name: { type: "string" },
        weight: { type: "number", format: "float" },
      },
      required: ["name"],
      discriminator: {
        propertyName: "kind",
        mapping: {
          cat: "#/components/schemas/Cat",
          dog: "#/components/schemas/Dog",
        },
      },
    });
    deepStrictEqual(openApi.components.schemas.Dog, {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["dog"] },
        breed: {
          type: "string",
          description: "Discriminator property for Dog.",
        },
        bark: { type: "string" },
      },
      required: ["kind", "bark"],
      allOf: [{ $ref: "#/components/schemas/Pet" }],
      discriminator: {
        propertyName: "breed",
        mapping: {
          beagle: "#/components/schemas/Beagle",
          poodle: "#/components/schemas/Poodle",
        },
      },
    });
    deepStrictEqual(openApi.components.schemas.Beagle.allOf, [
      { $ref: "#/components/schemas/Dog" },
    ]);
    deepStrictEqual(openApi.components.schemas.Poodle.allOf, [
      { $ref: "#/components/schemas/Dog" },
    ]);
  });

  it("issues diagnostics for errors in a discriminated union", async () => {
    const diagnostics = await checkFor(`
      @discriminator("kind")
      model Pet {
        name: string;
        weight?: float32;
      }
      model Cat extends Pet {
        kind: "cat";
        meow: int32;
      }
      model Dog extends Pet {
        petType: "dog";
        bark: string;
      }
      model Pig extends Pet {
        kind: int32;
        oink: float32;
      }
      model Tiger extends Pet {
        kind?: "tiger";
        claws: float32;
      }
      model Lizard extends Pet {
        kind: string;
        tail: float64;
      }

      op read(): Pet;
      `);

    expectDiagnostics(diagnostics, [
      {
        code: "missing-discriminator-property",
        message:
          /Each derived model of a discriminated model type should have set the discriminator property/,
      },
      {
        code: "invalid-discriminator-value",
        message: `Discriminator value should be a string, union of string or string enum but was Model.`,
      },
      {
        code: "invalid-discriminator-value",
        message: `The discriminator property must be a required property.`,
      },
      {
        code: "invalid-discriminator-value",
        message: `Discriminator value should be a string, union of string or string enum but was Model.`,
      },
    ]);
  });

  it("issues diagnostics for duplicate discriminator values", async () => {
    const diagnostics = await checkFor(`
      @discriminator("kind")
      model Pet {
      }
      model Cat extends Pet {
        kind: "cat" | "feline" | "housepet";
        meow: int32;
      }
      model Dog extends Pet {
        kind: "dog" | "housepet";
        bark: string;
      }
      model Beagle extends Pet {
        kind: "dog";
        bark: string;
      }

      op read(): Pet;
      `);

    expectDiagnostics(diagnostics, [
      {
        code: "invalid-discriminator-value",
        message: `Discriminator value "housepet" is already used in another variant.`,
      },
      {
        code: "invalid-discriminator-value",
        message: `Discriminator value "housepet" is already used in another variant.`,
      },
      {
        code: "invalid-discriminator-value",
        message: `Discriminator value "dog" is already used in another variant.`,
      },
      {
        code: "invalid-discriminator-value",
        message: `Discriminator value "dog" is already used in another variant.`,
      },
    ]);
  });
});
