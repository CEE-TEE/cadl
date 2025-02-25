---
id: unions
title: Unions
---

# Unions

Unions describe a type that must be exactly one of the union's constituents. There is 2 types of unions:

- union expressions
- named unions

## Union expressions

Unnamed unions can be declared by joining the variants using the `|` operator

```cadl
alias Breed = Beagle | GermanShepherd | GoldenRetriever;
```

Here it says that `Breed` can accept either a `Beagle`, a `GermanShepherd` or a `GoldenRetriever`.

## Named unions

Named unions provide a way to specify a name for the union as well as explicit variant reference. Named unions are in a way similar to [enums]({%doc "enums"%}) but instead of having `string` or `numeric` values it is a [record models]({%doc "models"%})

```cadl
union Breed {
  beagle: Beagle,
  shepherd: GermanShepherd,
  retriever: GoldenRetriever,
}
```

The above example is equivalent to the `Breed` alias above, except that emitters can actually see `Breed` as a named entity and also see the `beagle`, `shepherd`, and `retriever` names for the options. It also becomes possible to apply [decorators]() to each of the options when using this form.
