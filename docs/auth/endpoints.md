- Admin

* POST /admin/generate_link – create email action links (invite, magic link, recovery, etc.).
* GET /admin/user/{user_id} – fetch a single user by UUID.
* PUT /admin/user/{user_id} – update a user’s metadata, ban status, credentials, etc.
* DELETE /admin/user/{user_id} – remove a user.
* GET /admin/users – list users (cursor-based pagination supported via query params).
* POST /admin/users – provision a new user directly (optionally pre-confirming email/phone).

- Core Auth Flow

* GET /callback – OAuth provider redirect handler (completes external sign-in).
* GET /health – GoTrue health check and version info.
* POST /invite – send an invite email to a prospective user.
* POST /logout – revoke the refresh token for the current session.
* POST /otp – trigger passwordless login (email magic link or SMS OTP).
* POST /recover – send a password recovery email.
* GET /settings – retrieve current GoTrue configuration flags (signup enabled, providers, etc.).
* POST /signup – email or phone + password registration (optionally with metadata).
* POST /token?grant_type=password – email/phone + password sign-in, returns access/refresh tokens.
* POST /token?grant_type=refresh_token – exchange refresh token for a new session.
* GET /user – fetch the authenticated user (identified by bearer token).
* PUT /user – update the authenticated user’s profile, email/phone, or password.
* POST /verify – verify signup or recovery tokens (email, phone, or redirect flows).
