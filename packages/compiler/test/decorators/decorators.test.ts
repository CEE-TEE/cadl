import { deepStrictEqual, ok, strictEqual } from "assert";
import { getVisibility, isSecret, Model, Operation } from "../../core/index.js";
import {
  getDoc,
  getFriendlyName,
  getKeyName,
  getKnownValues,
  getOverloadedOperation,
  getOverloads,
  isErrorModel,
} from "../../lib/decorators.js";
import {
  BasicTestRunner,
  createTestRunner,
  expectDiagnosticEmpty,
  expectDiagnostics,
} from "../../testing/index.js";

describe("compiler: built-in decorators", () => {
  let runner: BasicTestRunner;

  beforeEach(async () => {
    runner = await createTestRunner();
  });

  describe("@doc", () => {
    it("applies @doc on model", async () => {
      const { A } = await runner.compile(
        `
        @test
        @doc("My Doc")
        model A { }
        `
      );

      strictEqual(getDoc(runner.program, A), "My Doc");
    });

    it("formats @doc string using source object", async () => {
      const { A, B } = await runner.compile(
        `
        @doc("Templated {name}", T)
        model Template<T>  {
        }

        @test
        @doc("Model {name}", A)
        model A { }

        @test
        model B is Template<B> {
        }
        `
      );
      strictEqual(getDoc(runner.program, A), "Model A");
      strictEqual(getDoc(runner.program, B), "Templated B");
    });

    it("applies @doc on namespace", async () => {
      const { TestDoc } = await runner.compile(
        `
        @test
        @doc("doc for namespace")
        namespace TestDoc {
        }
        `
      );

      strictEqual(getDoc(runner.program, TestDoc), "doc for namespace");
    });

    it("applies @doc on enum", async () => {
      const { Color, Red } = await runner.compile(
        `
        @test
        @doc("doc for enum")
        enum Color {
          @test
          @doc("doc for enum element")
          Red: "red",
        }
        `
      );

      strictEqual(getDoc(runner.program, Color), "doc for enum");
      strictEqual(getDoc(runner.program, Red), "doc for enum element");
    });

    it("applies @doc on union", async () => {
      const { AB } = await runner.compile(
        `
        model A { }
        model B { }

        @test
        @doc("doc for union")
        union AB { a: A, b: B }
        `
      );

      strictEqual(getDoc(runner.program, AB), "doc for union");
    });

    it("applies @doc on interfaces", async () => {
      const { TestDoc, a } = await runner.compile(
        `
        @test
        @doc("doc for interface")
        interface TestDoc {
          @test
          @doc("doc for interface operation")
          a(): string;
        }
        `
      );

      strictEqual(getDoc(runner.program, TestDoc), "doc for interface");
      strictEqual(getDoc(runner.program, a), "doc for interface operation");
    });

    it("applies @doc on operations", async () => {
      const { b } = await runner.compile(
        `
        @test
        @doc("doc for an operation")
        op b(): string;
        `
      );

      strictEqual(getDoc(runner.program, b), "doc for an operation");
    });

    it("emit diagnostic if doc is not a string", async () => {
      const diagnostics = await runner.diagnose(`
        @doc("foo" | "bar")
        model A { }
      `);

      expectDiagnostics(diagnostics, {
        code: "invalid-argument",
        message: `Argument 'foo | bar' of type 'Union' is not assignable to parameter of type 'String'`,
      });
    });
  });

  describe("@friendlyName", () => {
    it("applies @friendlyName on model", async () => {
      const { A, B, C } = await runner.compile(`
        @test
        @friendlyName("MyNameIsA")
        model A { }

        @test
        @friendlyName("{name}Model", B)
        model B { }

        @friendlyName("Templated{name}", T)
        model Templated<T> {
          prop: T;
        }

        @test
        model C is Templated<B>{};
        `);
      strictEqual(getFriendlyName(runner.program, A), "MyNameIsA");
      strictEqual(getFriendlyName(runner.program, B), "BModel");
      strictEqual(getFriendlyName(runner.program, C), "TemplatedB");
    });
  });

  describe("@error", () => {
    it("applies @error on model", async () => {
      const { A } = await runner.compile(`
        @test
        @error
        model A { }
      `);
      ok(isErrorModel(runner.program, A), "isError should be true");
    });

    it("emit diagnostic if error is not applied to a model", async () => {
      const diagnostics = await runner.diagnose(`
        @error
        enum A { B, C }
        `);

      strictEqual(diagnostics.length, 1);
      strictEqual(diagnostics[0].code, "decorator-wrong-target");
      strictEqual(diagnostics[0].message, `Cannot apply @error decorator to Enum`);
    });
  });

  describe("@knownValues", () => {
    it("assign the known values to string model", async () => {
      const { Bar } = (await runner.compile(`
        enum Foo {one: "one", two: "two"}
        @test
        @knownValues(Foo)
        model Bar is string {}
      `)) as { Bar: Model };

      ok(Bar.kind);
      const knownValues = getKnownValues(runner.program, Bar);
      ok(knownValues);
      strictEqual(knownValues.kind, "Enum");
    });

    it("assign the known values to number model", async () => {
      const { Bar } = (await runner.compile(`
        enum Foo {
          one: 1; 
          two: 2;
        }
        @test
        @knownValues(Foo)
        model Bar is int32 {}
      `)) as { Bar: Model };

      ok(Bar.kind);
      const knownValues = getKnownValues(runner.program, Bar);
      ok(knownValues);
      strictEqual(knownValues.kind, "Enum");
    });

    it("emit diagnostics when used on non model", async () => {
      const diagnostics = await runner.diagnose(`
        enum Foo {one, two}
        @knownValues(Foo)
        enum Bar {}
      `);

      expectDiagnostics(diagnostics, {
        code: "decorator-wrong-target",
        message: "Cannot apply @format decorator to Enum",
      });
    });

    it("emit diagnostics when enum has invalid members", async () => {
      const diagnostics = await runner.diagnose(`
         enum Foo {
          one: 1; 
          two: 2;
        }
        @knownValues(Foo)
        model Bar is string {}
      `);

      expectDiagnostics(diagnostics, {
        code: "known-values-invalid-enum",
        message: "Enum cannot be used on this type. Member one is not assignable to type string.",
      });
    });

    it("emit diagnostics when used on non string model", async () => {
      const diagnostics = await runner.diagnose(`
        enum Foo {one, two}
        @knownValues(Foo)
        model Bar {}
      `);

      expectDiagnostics(diagnostics, {
        code: "decorator-wrong-target",
        message:
          "Cannot apply @knownValues decorator to type it is not one of: string, int8, int16, int32, int64, float32, float64",
      });
    });

    it("emit diagnostics when known values is not an enum", async () => {
      const diagnostics = await runner.diagnose(`
        model Foo {}
        @knownValues(Foo)
        model Bar is string {}
      `);

      expectDiagnostics(diagnostics, {
        code: "invalid-argument",
        message: "Argument 'Foo' of type 'Model' is not assignable to parameter of type 'Enum'",
      });
    });
  });

  describe("@key", () => {
    it("emits diagnostic when argument is not a string", async () => {
      const diagnostics = await runner.diagnose(
        `model M {
          @key(4)
          prop: string;
        }`
      );

      expectDiagnostics(diagnostics, [
        {
          code: "invalid-argument",
          message: "Argument '4' of type 'Number' is not assignable to parameter of type 'String'",
        },
      ]);
    });

    it("emits diagnostic when not applied to model property", async () => {
      const diagnostics = await runner.diagnose(
        `@key
        model M {}`
      );

      expectDiagnostics(diagnostics, [
        {
          code: "decorator-wrong-target",
          message: "Cannot apply @key decorator to Model",
        },
      ]);
    });

    it("sets key to property name by default", async () => {
      const { prop } = await runner.compile(
        `model M {
          @test
          @key
          prop: string;
        }`
      );

      strictEqual(prop.kind, "ModelProperty" as const);
      strictEqual(getKeyName(runner.program, prop), "prop");
    });

    it("sets key to alternate name when provided", async () => {
      const { prop } = await runner.compile(
        `model M {
          @test
          @key("alternateName")
          prop: string;
        }`
      );

      strictEqual(prop.kind, "ModelProperty" as const);
      strictEqual(getKeyName(runner.program, prop), "alternateName");
    });

    it("emits diagnostic when key property is marked as optional", async () => {
      const diagnostics = await runner.diagnose(
        `model M {
          @key
          prop?: string;
        }`
      );

      expectDiagnostics(diagnostics, [
        {
          code: "no-optional-key",
          message: "Property 'prop' marked as key cannot be optional.",
        },
      ]);
    });
  });

  describe("@withoutOmittedProperties", () => {
    it("removes a model property when given a string literal", async () => {
      const { TestModel } = await runner.compile(
        `
        model OriginalModel {
          removeMe: string;
          notMe: string;
        }

        @test
        model TestModel is OmitProperties<OriginalModel, "removeMe"> {
        }`
      );

      const properties = TestModel.kind === "Model" ? Array.from(TestModel.properties.keys()) : [];
      deepStrictEqual(properties, ["notMe"]);
    });

    it("removes model properties when given a union containing strings", async () => {
      const { TestModel } = await runner.compile(
        `
        model OriginalModel {
          removeMe: string;
          removeMeToo: string;
          notMe: string;
        }

        @test
        model TestModel is OmitProperties<OriginalModel, "removeMe" | "removeMeToo"> {
        }`
      );

      const properties = TestModel.kind === "Model" ? Array.from(TestModel.properties.keys()) : [];
      deepStrictEqual(properties, ["notMe"]);
    });
  });

  describe("@withDefaultKeyVisibility", () => {
    it("sets the default visibility on a key property when not already present", async () => {
      const { TestModel } = (await runner.compile(
        `
        model OriginalModel {
          @key
          name: string;
        }

        @test
        model TestModel is DefaultKeyVisibility<OriginalModel, "read"> {
        } `
      )) as { TestModel: Model };

      deepStrictEqual(getVisibility(runner.program, TestModel.properties.get("name")!), ["read"]);
    });

    it("allows visibility applied to a key property to override the default", async () => {
      const { TestModel } = (await runner.compile(
        `
        model OriginalModel {
          @key
          @visibility("read", "update")
          name: string;
        }

        @test
        model TestModel is DefaultKeyVisibility<OriginalModel, "create"> {
        } `
      )) as { TestModel: Model };

      deepStrictEqual(getVisibility(runner.program, TestModel.properties.get("name")!), [
        "read",
        "update",
      ]);
    });
  });

  describe("@deprecated", () => {
    it("doesn't emit warning until it is used", async () => {
      const diagnostics = await runner.diagnose(`
        @deprecated("Foo is deprecated use Bar")
        model Foo { }
        model Test  { }
      `);
      expectDiagnosticEmpty(diagnostics);
    });

    it("emit warning diagnostic when used via is", async () => {
      const diagnostics = await runner.diagnose(`
        @deprecated("Foo is deprecated use Bar")
        model Foo { }

        model Test is Foo { }
      `);
      expectDiagnostics(diagnostics, {
        code: "deprecated",
        message: "Deprecated: Foo is deprecated use Bar",
        severity: "warning",
      });
    });

    it("emit warning diagnostic when used via extends", async () => {
      const diagnostics = await runner.diagnose(`
        @deprecated("Foo is deprecated use Bar")
        model Foo { }

        model Test extends Foo { }
      `);
      expectDiagnostics(diagnostics, {
        code: "deprecated",
        message: "Deprecated: Foo is deprecated use Bar",
        severity: "warning",
      });
    });

    it("emit warning diagnostic when used via property type", async () => {
      const diagnostics = await runner.diagnose(`
        @deprecated("Foo is deprecated use Bar")
        model Foo { }

        model Test { foo: Foo }
      `);
      expectDiagnostics(diagnostics, {
        code: "deprecated",
        message: "Deprecated: Foo is deprecated use Bar",
        severity: "warning",
      });
    });

    it("emit warning diagnostic when used via spread", async () => {
      const diagnostics = await runner.diagnose(`
        @deprecated("Foo is deprecated use Bar")
        model Foo { }

        model Test { ...Foo }
      `);
      expectDiagnostics(diagnostics, {
        code: "deprecated",
        message: "Deprecated: Foo is deprecated use Bar",
        severity: "warning",
      });
    });
  });

  describe("@overload", () => {
    it("emits an error when @overload is given something other than an operation", async () => {
      const diagnostics = await runner.diagnose(`
        @overload("foo")
        op someStringThing(param: string): string;
      `);

      expectDiagnostics(diagnostics, {
        code: "invalid-argument",
        message:
          "Argument 'foo' of type 'String' is not assignable to parameter of type 'Operation'",
        severity: "error",
      });
    });

    it("emits an error when the overload's parameters are unrelated to the overloaded operation", async () => {
      const diagnostics = await runner.diagnose(`
        op someThing(param: string | int32): string | int32;

        @overload(someThing)
        op someUnrelatedThing(foo: boolean): string;

        @overload(someThing)
        op anotherUnrelatedThing(param: boolean): string;

        @overload(someThing)
        op thisOneWorks(param: string, foo: int32): string;
      `);

      expectDiagnostics(diagnostics, [
        {
          code: "missing-property",
          message:
            "Property 'param' is missing on type '(anonymous model)' but required in '(anonymous model)'",
          severity: "error",
        },
        {
          code: "unassignable",
          message: "Type 'Cadl.boolean' is not assignable to type 'Cadl.string | Cadl.int32'",
          severity: "error",
        },
      ]);
    });

    it("can define operation overloads outside of a namespace or interface", async () => {
      const compiled = (await runner.compile(`
        @test
        op someThing(param: string | int32): string | int32;

        @test
        @overload(someThing)
        op someStringThing(param: string): string;

        @test
        @overload(someThing)
        op someNumberThing(param: int32): int32;

        @test
        op someUnrelatedThing(): void;

      `)) as {
        someThing: Operation;
        someStringThing: Operation;
        someNumberThing: Operation;
        someUnrelatedThing: Operation;
      };

      strictEqual(compiled.someThing.kind, "Operation");
      ok(getOverloadedOperation(runner.program, compiled.someStringThing));
      ok(getOverloadedOperation(runner.program, compiled.someNumberThing));
      ok(!getOverloadedOperation(runner.program, compiled.someThing));
      ok(!getOverloadedOperation(runner.program, compiled.someUnrelatedThing));
      const overloadedBy = getOverloads(runner.program, compiled.someThing)?.map((op) => op.name);
      ok(overloadedBy?.length == 2);
      ok(overloadedBy?.includes("someStringThing"));
      ok(overloadedBy?.includes("someNumberThing"));
      ok(getOverloads(runner.program, compiled.someUnrelatedThing) === undefined);
    });

    it("can overload operations defined in a namespace", async () => {
      const compiled = (await runner.compile(`
        namespace MyArea {
          @test
          op someThing(param: string | int32): string | int32;

          @test
          @overload(someThing)
          op someStringThing(param: string): string;

          @test
          @overload(MyArea.someThing)
          op someNumberThing(param: int32): int32;
        }

      `)) as {
        someThing: Operation;
        someStringThing: Operation;
        someNumberThing: Operation;
      };

      strictEqual(compiled.someThing.kind, "Operation");
      ok(getOverloadedOperation(runner.program, compiled.someStringThing));
      ok(getOverloadedOperation(runner.program, compiled.someNumberThing));
      ok(!getOverloadedOperation(runner.program, compiled.someThing));
      const overloadedBy = getOverloads(runner.program, compiled.someThing)?.map((op) => op.name);
      ok(overloadedBy?.length == 2);
      ok(overloadedBy?.includes("someStringThing"));
      ok(overloadedBy?.includes("someNumberThing"));
    });

    it("can overload operations defined in an interface", async () => {
      const compiled = (await runner.compile(`
        interface SomeInterface {
          @test
          op someThing(param: string | int32): string | int32;

          @test
          @overload(SomeInterface.someThing)
          op someStringThing(param: string): string;

          @test
          @overload(SomeInterface.someThing)
          op someNumberThing(param: int32): int32;
        }
      `)) as {
        someThing: Operation;
        someStringThing: Operation;
        someNumberThing: Operation;
      };

      strictEqual(compiled.someThing.kind, "Operation");
      ok(getOverloadedOperation(runner.program, compiled.someStringThing));
      ok(getOverloadedOperation(runner.program, compiled.someNumberThing));
      ok(!getOverloadedOperation(runner.program, compiled.someThing));
      const overloadedBy = getOverloads(runner.program, compiled.someThing)?.map((op) => op.name);
      ok(overloadedBy?.length == 2);
      ok(overloadedBy?.includes("someStringThing"));
      ok(overloadedBy?.includes("someNumberThing"));
    });

    describe("overloads must have the same parent as the overload base", () => {
      it("emit diagnostic if outside of interface", async () => {
        const diagnostics = await runner.diagnose(`
          interface SomeInterface {
            someThing(param: string | int32): string | int32;
          }
  
          @overload(SomeInterface.someThing)
          op someStringThing(param: string): string;
        `);
        expectDiagnostics(diagnostics, {
          code: "overload-same-parent",
          message: "Overload must be in the same interface or namespace.",
        });
      });

      it("emit diagnostic if outside of namespace", async () => {
        const diagnostics = await runner.diagnose(`
          namespace SomeNamespace {
            op someThing(param: string | int32): string | int32;
          }
  
          @overload(SomeNamespace.someThing)
          op someStringThing(param: string): string;
        `);
        expectDiagnostics(diagnostics, {
          code: "overload-same-parent",
          message: "Overload must be in the same interface or namespace.",
        });
      });

      it("emit diagnostic if different interface", async () => {
        const diagnostics = await runner.diagnose(`
          interface SomeInterface {
            someThing(param: string | int32): string | int32;
          }
  
          interface OtherInterface {
            @overload(SomeInterface.someThing)
            someStringThing(param: string): string;
          }
        `);
        expectDiagnostics(diagnostics, {
          code: "overload-same-parent",
          message: "Overload must be in the same interface or namespace.",
        });
      });

      it("emit diagnostic if different namespace", async () => {
        const diagnostics = await runner.diagnose(`
          namespace SomeNamespace {
            op someThing(param: string | int32): string | int32;
          }
  
          namespace OtherNamespace {
            @overload(SomeNamespace.someThing)
            op someStringThing(param: string): string;
          }
        `);
        expectDiagnostics(diagnostics, {
          code: "overload-same-parent",
          message: "Overload must be in the same interface or namespace.",
        });
      });

      it("emit diagnostic if in an interface but base isn't", async () => {
        const diagnostics = await runner.diagnose(`
          op someThing(param: string | int32): string | int32;
  
          interface OtherInterface {
            @overload(someThing)
            someStringThing(param: string): string;
          }
        `);
        expectDiagnostics(diagnostics, {
          code: "overload-same-parent",
          message: "Overload must be in the same interface or namespace.",
        });
      });
    });
  });

  describe("@secret", () => {
    it("can be applied on a string model", async () => {
      const { A } = await runner.compile(
        `
        @test
        @secret
        model A is string;
        `
      );

      ok(isSecret(runner.program, A));
    });

    it("can be applied on a model property with string type", async () => {
      const { A } = (await runner.compile(
        `
        @test
        model A {
          @secret
          a: string;
        }
        `
      )) as { A: Model };

      ok(isSecret(runner.program, A.properties.get("a")!));
    });

    it("can be applied on a model property with stringlike model as type", async () => {
      const { A } = (await runner.compile(
        `
        model CustomStr is string;

        @test
        model A {
          @secret
          a: CustomStr;
        }
        `
      )) as { A: Model };

      ok(isSecret(runner.program, A.properties.get("a")!));
    });

    it("emit diagnostic if model is not a string", async () => {
      const diagnostics = await runner.diagnose(
        `
        @test
        @secret
        model A {}
        `
      );

      expectDiagnostics(diagnostics, {
        code: "decorator-wrong-target",
        message: "Cannot apply @secret decorator to type it is not one of: string",
      });
    });

    it("emit diagnostic if model is a different intrinsic type(not a string)", async () => {
      const diagnostics = await runner.diagnose(
        `
        @test
        @secret
        model A is int32 {}
        `
      );

      expectDiagnostics(diagnostics, {
        code: "decorator-wrong-target",
        message: "Cannot apply @secret decorator to type it is not one of: string",
      });
    });

    it("emit diagnostic if model property is not a string type", async () => {
      const diagnostics = await runner.diagnose(
        `
        @test
        model A {
          @secret
          a: int32;
        }
        `
      );

      expectDiagnostics(diagnostics, {
        code: "decorator-wrong-target",
        message: "Cannot apply @secret decorator to type it is not one of: string",
      });
    });
  });

  describe("@discriminator on unions", () => {
    it("requires variants to be models", async () => {
      const diagnostics = await runner.diagnose(`
        @discriminator("kind")
        union Foo {
          a: "hi"
        }
      `);

      expectDiagnostics(diagnostics, [
        {
          code: "invalid-discriminated-union-variant",
          message: `Union variant "a" must be a model type.`,
        },
      ]);
    });
    it("requires variants to have the discriminator property", async () => {
      const diagnostics = await runner.diagnose(`
        model A {

        }
        @discriminator("kind")
        union Foo {
          a: A
        }
      `);

      expectDiagnostics(diagnostics, [
        {
          code: "invalid-discriminated-union-variant",
          message: `Variant "a" type is missing the discriminant property "kind".`,
        },
      ]);
    });

    it("requires variant discriminator properties to be string literals or string enum values", async () => {
      const diagnostics = await runner.diagnose(`
        model A {
          kind: string,
        }

        @discriminator("kind")
        union Foo {
          a: A
        }
      `);

      expectDiagnostics(diagnostics, [
        {
          code: "invalid-discriminated-union-variant",
          message: `Variant "a" type's discriminant property "kind" must be a string literal or string enum member.`,
        },
      ]);
    });
  });
});
