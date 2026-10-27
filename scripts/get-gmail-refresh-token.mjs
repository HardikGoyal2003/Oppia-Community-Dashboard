#!/usr/bin/env node

/**
 * Mints a Gmail OAuth2 refresh token for the dashboard's SMTP transport.
 *
 * Google stopped issuing App Passwords for some accounts, so SMTP can instead
 * authenticate with OAuth2 (XOAUTH2). The dashboard only needs a refresh
 * token; nodemailer exchanges it for short-lived access tokens at send time.
 *
 * Prerequisites (one-time, in Google Cloud Console):
 *   1. Create a project and enable the Gmail API.
 *   2. Configure an OAuth consent screen (External for a personal Gmail
 *      account, Internal for a Google Workspace org).
 *   3. Create an OAuth client of type "Desktop app".
 *   4. Put its id and secret in GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET.
 *
 * Usage:
 *   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \
 *     npm run gmail:refresh-token
 *
 * The script starts a loopback listener, prints an authorization URL, and
 * exchanges the returned code for a refresh token. It never reads `.env` files;
 * only the current process environment is used.
 */

import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret) {
  console.error(
    "\nGOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are required.\n",
  );
  console.error(
    "Create a Desktop OAuth client in Google Cloud Console, then re-run:\n" +
      "  GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... npm run gmail:refresh-token\n",
  );
  process.exit(1);
}

const state = randomBytes(16).toString("base64url");
const codeVerifier = randomBytes(32).toString("base64url");
const codeChallenge = createHash("sha256")
  .update(codeVerifier)
  .digest("base64url");

/** @type {string} */
let redirectUri = "";
/** @type {import("node:http").Server | undefined} */
let server;
/** @type {NodeJS.Timeout | undefined} */
let callbackTimeout;

/**
 * Closes the listener and exits with the given status.
 *
 * @param {number} code The process exit code.
 * @returns {never} Always exits.
 */
function shutdown(code) {
  if (callbackTimeout) {
    clearTimeout(callbackTimeout);
  }

  server?.close();
  process.exit(code);
}

/**
 * Lets the browser response flush before exiting.
 *
 * @param {number} code The process exit code.
 * @returns {void}
 */
function shutdownAfterResponse(code) {
  setTimeout(() => shutdown(code), 250);
}

/**
 * Decodes a JWT payload without verifying it. The token comes directly from
 * Google over TLS in the exchange response, so verification adds nothing here.
 *
 * @param {string} jwt The encoded identity token.
 * @returns {Record<string, unknown>} The decoded payload.
 */
function decodeJwtPayload(jwt) {
  const payload = jwt.split(".")[1];

  if (!payload) {
    return {};
  }

  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

/**
 * Exchanges an authorization code for tokens.
 *
 * @param {string} code The authorization code.
 * @returns {Promise<Record<string, unknown>>} The token response.
 */
async function exchangeCode(code) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      `Token exchange failed (${response.status}): ${JSON.stringify(payload)}`,
    );
  }

  return payload;
}

server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  // Ignore favicon and other stray requests while waiting for the redirect.
  if (!code && !oauthError) {
    res.writeHead(404).end("Not found.");
    return;
  }

  /**
   * Sends a plain-text browser response.
   *
   * @param {number} status The HTTP status code.
   * @param {string} message The message to display.
   * @returns {void}
   */
  const respond = (status, message) => {
    res
      .writeHead(status, { "Content-Type": "text/plain; charset=utf-8" })
      .end(message);
  };

  if (oauthError) {
    respond(
      400,
      `Authorization failed: ${oauthError}. You can close this tab.`,
    );
    console.error(`\nAuthorization failed: ${oauthError}`);
    shutdownAfterResponse(1);
    return;
  }

  if (returnedState !== state) {
    respond(400, "State mismatch. You can close this tab.");
    console.error("\nState mismatch; refusing to exchange the code.");
    shutdownAfterResponse(1);
    return;
  }

  try {
    const tokens = await exchangeCode(code);
    const refreshToken = tokens.refresh_token;
    const idToken = tokens.id_token;
    const email =
      typeof idToken === "string" ? decodeJwtPayload(idToken).email : undefined;
    const account = typeof email === "string" ? email : "(unknown)";

    respond(
      200,
      "Authorization complete. You can close this tab and return to the terminal.",
    );

    console.log("\nOAuth2 authorization succeeded.");
    console.log(`Authorized account: ${account}`);

    if (typeof refreshToken !== "string" || !refreshToken) {
      console.error(
        "\nNo refresh token was returned. Revoke the app's access at " +
          "https://myaccount.google.com/permissions and run this script again.",
      );
      shutdownAfterResponse(1);
      return;
    }

    console.log("\nAdd these to your environment (and to Vercel):\n");
    console.log(
      `SMTP_USER=${typeof email === "string" ? email : "<gmail address>"}`,
    );
    console.log(`GOOGLE_OAUTH_CLIENT_ID=${clientId}`);
    console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${clientSecret}`);
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${refreshToken}`);
    console.log(
      '\nIf the consent screen is still in "Testing" status, Google expires\n' +
        "refresh tokens after 7 days. Publish the app (External) or use an\n" +
        "Internal app for a Workspace account before relying on this in cron.\n",
    );

    shutdownAfterResponse(0);
  } catch (error) {
    respond(500, "Token exchange failed. You can close this tab.");
    console.error(
      `\n${error instanceof Error ? error.message : String(error)}`,
    );
    shutdownAfterResponse(1);
  }
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();

  if (!address || typeof address === "string") {
    console.error("\nCould not bind the loopback listener.\n");
    shutdown(1);
    return;
  }

  redirectUri = `http://127.0.0.1:${address.port}`;

  const authUrl = new URL(AUTH_ENDPOINT);

  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", `openid email ${GMAIL_SEND_SCOPE}`);
  authUrl.searchParams.set("access_type", "offline");
  // Force a refresh token even when the account has authorized the app before.
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  console.log("\nOpen this URL in a browser and approve access:\n");
  console.log(authUrl.toString());
  console.log(
    "\nWaiting for the Google redirect (5 minute timeout). Desktop clients\n" +
      "allow loopback redirects, so no redirect URI needs to be registered.\n",
  );

  callbackTimeout = setTimeout(() => {
    console.error("\nTimed out waiting for authorization.");
    shutdown(1);
  }, CALLBACK_TIMEOUT_MS);
});
