# autenticacion-usuarios Specification

## Purpose
Identidad de los usuarios de la herramienta: que alguien pueda registrarse con su email, mantener su sesión abierta sin volver a escribir la contraseña en cada recarga, y que el servidor confíe en esa sesión sin guardar contraseñas en claro. Cubre el ciclo completo (alta, login, renovación de sesión, perfil y cierre de sesión) sobre autenticación propia, sin proveedor externo. Ver [AD-017](../../docs/09-decisiones-de-diseno.md#ad-017-autenticacion-propia-emailpassword--jwt).

## Requirements

### Requirement: Registro de usuario

El server SHALL registrar un usuario con email único, password hasheado (bcrypt), nombre y avatar opcional, y devolver access token (15 min) + refresh token (httpOnly cookie, 7 días).

#### Scenario: Registrar usuario nuevo

- **WHEN** el client envía `POST /api/auth/register` con `{ email, password, name }`
- **THEN** el server responde `201` con `{ user: { id, email, name, avatar?, createdAt }, accessToken }`
- **AND** setea cookie httpOnly `refreshToken`
- **AND** el email no existe previamente

#### Scenario: Email duplicado

- **WHEN** el client envía `POST /api/auth/register` con un email ya registrado
- **THEN** el server responde `409` con `{ error: "Email ya registrado" }`

#### Scenario: Datos inválidos

- **WHEN** el client envía `POST /api/auth/register` con email inválido o password < 8 chars
- **THEN** el server responde `400` con `{ error: "Datos inválidos", issues: [...] }`

---

### Requirement: Login

El server SHALL validar credenciales y devolver access token + refresh token cookie.

#### Scenario: Login exitoso

- **WHEN** el client envía `POST /api/auth/login` con `{ email, password }`
- **THEN** el server responde `200` con `{ user, accessToken }` + cookie `refreshToken`

#### Scenario: Credenciales inválidas

- **WHEN** el client envía `POST /api/auth/login` con password incorrecto
- **THEN** el server responde `401` con `{ error: "Credenciales inválidas" }`

#### Scenario: Usuario no existe

- **WHEN** el client envía `POST /api/auth/login` con email no registrado
- **THEN** el server responde `401` con `{ error: "Credenciales inválidas" }` (mismo mensaje por seguridad)

---

### Requirement: Refresh token

El server SHALL emitir nuevo access token a partir de refresh token válido.

#### Scenario: Access token expirado, refresh válido

- **WHEN** el client envía `POST /api/auth/refresh` con cookie `refreshToken`
- **THEN** el server responde `200` con `{ accessToken }` (nuevo)
- **AND** opcionalmente rota el refresh token (nuevo refresh token en cookie)

#### Scenario: Refresh token inválido/expirado

- **WHEN** el client envía `POST /api/auth/refresh` con refresh token inválido, expirado o revocado
- **THEN** el server responde `401` con `{ error: "Sesión expirada, inicie sesión de nuevo" }`
- **AND** limpia cookie `refreshToken`

---

### Requirement: Perfil de usuario

El server SHALL permitir obtener y actualizar el perfil del usuario autenticado.

#### Scenario: Obtener perfil

- **WHEN** el client hace `GET /api/auth/me` con access token válido
- **THEN** el server responde `200` con `{ id, email, name, avatar?, createdAt }`

#### Scenario: Actualizar perfil

- **WHEN** el client envía `PUT /api/auth/me` con `{ name?, avatar? }`
- **THEN** el server responde `200` con perfil actualizado

#### Scenario: No autenticado

- **WHEN** el client hace `GET /api/auth/me` sin access token válido
- **THEN** el server responde `401` con `{ error: "No autenticado" }`
