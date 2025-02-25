# Configure Http Authentication

Notes:

- Authentication right now can ONLY be configured at the service level.

## Configure

Authentication can be configured using the `@useAuth` decorator on the service namespace. The decorator accept a few options:

- A security scheme(see options [here]). This means this is the security scheme to use to authenticate this service.

```cadl
@useAuth(Auth1)
```

- A tuple of security scheme. This means ALL the different security schemes of the tuple MUST be used together to authenticate this service.

```cadl
// Use BOTH Auth1 or Auth2
@useAuth([Auth1 Auth2])
```

- A union of security scheme. This means EITHER of the security schemes can be used to authenticate this service

```cadl
// Use EITHER Auth1 or Auth2
@useAuth([Auth1 Auth2])
```

- A union of tuple security scheme. This means EITHER of the security groups schemes can be used to authenticate this service

```cadl
// Use EITHER (Auth1 AND Auth2) OR Auth3
@useAuth([Auth1 Auth2] | Auth3)
```

## Available security schemes

Models can be found in https://github.com/microsoft/cadl/blob/main/packages/rest/lib/auth.cadl

### `BasicAuth`

Basic authentication is a simple authentication scheme built into the HTTP protocol.
The client sends HTTP requests with the Authorization header that contains the word Basic word followed by a space and a base64-encoded string username:password.
For example, to authorize as demo / p@55w0rd the client would send

```
 Authorization: Basic ZGVtbzpwQDU1dzByZA==
```

### `BearerAuth`

Bearer authentication (also called token authentication) is an HTTP authentication scheme that involves security tokens called bearer tokens.
The name “Bearer authentication” can be understood as “give access to the bearer of this token.” The bearer token is a cryptic string, usually generated by the server in response to a login request.
The client must send this token in the Authorization header when making requests to protected resources:

```
  Authorization: Bearer <token>
```

### `ApiKeyAuth<TLocation extends ApiKeyLocation, TName extends string>`

An API key is a token that a client provides when making API calls. The key can be sent in the query string:

```
GET /something?api_key=abcdef12345
```

or as a request header

```
GET /something HTTP/1.1
X-API-Key: abcdef12345
```

or as a cookie

```
GET /something HTTP/1.1
Cookie: X-API-KEY=abcdef12345
```

### `OAuth2Auth<TFlows extends OAuth2Flow[]>`

OAuth 2.0 is an authorization protocol that gives an API client limited access to user data on a web server.
OAuth relies on authentication scenarios called flows, which allow the resource owner (user) to share the protected content from the resource server without sharing their credentials.
For that purpose, an OAuth 2.0 server issues access tokens that the client applications can use to access protected resources on behalf of the resource owner.
For more information about OAuth 2.0, see oauth.net and RFC 6749.
