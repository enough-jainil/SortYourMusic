/**
 * Spotify Authentication Module using PKCE flow
 */

class SpotifyAuth {
  constructor() {
    this.accessToken = null;
    this.curUserID = null;
  }

  // Generate cryptographically secure random string for PKCE
  generateRandomString(length) {
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  }

  // SHA256 hash function
  async sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest("SHA-256", data);
  }

  // Base64 encode for PKCE
  base64encode(input) {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  // PKCE Authorization with modern flow
  async authorizeUser() {
    var scopes =
      "playlist-read-private playlist-modify-private playlist-modify-public";

    // Generate PKCE code verifier and challenge
    const codeVerifier = this.generateRandomString(64);
    const hashed = await this.sha256(codeVerifier);
    const codeChallenge = this.base64encode(hashed);

    // Store code verifier for token exchange
    window.localStorage.setItem("code_verifier", codeVerifier);

    // Build authorization URL with PKCE parameters
    const authUrl = new URL("https://accounts.spotify.com/authorize");
    const params = {
      response_type: "code",
      client_id: SPOTIFY_CLIENT_ID,
      scope: scopes,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      state: this.generateRandomString(16), // CSRF protection
    };

    authUrl.search = new URLSearchParams(params).toString();
    window.location.href = authUrl.toString();
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code) {
    const codeVerifier = localStorage.getItem("code_verifier");

    if (!codeVerifier) {
      throw new Error("Code verifier not found");
    }

    const url = "https://accounts.spotify.com/api/token";
    const payload = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    };

    const response = await fetch(url, payload);

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const data = await response.json();

    // Store tokens
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    localStorage.setItem(
      "token_expires_at",
      Date.now() + data.expires_in * 1000
    );

    // Clean up
    localStorage.removeItem("code_verifier");

    this.accessToken = data.access_token;
    return data.access_token;
  }

  // Parse URL parameters for PKCE flow (uses query params instead of hash)
  parseArgs() {
    // Check if we have URL query parameters (PKCE flow)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("code")) {
      return {
        code: urlParams.get("code"),
        state: urlParams.get("state"),
        error: urlParams.get("error"),
      };
    }

    // Fallback to old hash parsing for backward compatibility
    var hash = location.hash.replace(/#/g, "");
    var all = hash.split("&");
    var args = {};
    _.each(all, function (keyvalue) {
      var kv = keyvalue.split("=");
      var key = kv[0];
      var val = kv[1];
      args[key] = val;
    });
    return args;
  }

  // Check if we have a valid stored token
  hasValidToken() {
    const storedToken = localStorage.getItem("access_token");
    const tokenExpiry = localStorage.getItem("token_expires_at");

    if (storedToken && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
      this.accessToken = storedToken;
      return true;
    }
    return false;
  }

  getAccessToken() {
    return this.accessToken;
  }

  setAccessToken(token) {
    this.accessToken = token;
  }

  getCurrentUser() {
    return this.curUserID;
  }

  setCurrentUser(userID) {
    this.curUserID = userID;
  }
}

// Export as global for backward compatibility
window.SpotifyAuth = SpotifyAuth;
