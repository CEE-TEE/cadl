---
id: aliases
title: Aliases
---

# Alias

Aliases can be defined for types. This can be helpful to reuse a complex expression.

Alias is only a syntax helper, and it has no representation in the type graph. This means that aliases cannot be decorated. Use [`model is`]({{"/docs/language-basics/models" | url}}) to provide an alternate name for a model.

Alias can be defined using the `alias` keyword

```cadl
alias Options = "one" | "two";
```
