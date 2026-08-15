const express = require("express");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
    path: path.join(__dirname, "server", ".env")
});

const app = express();
const PORT = process.env.PORT || 3000;

let accessToken = null;
let refreshToken = process.env.TWITCH_REFRESH_TOKEN || null;
let broadcasterId = null;

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
});

async function refreshTwitchToken() {
    if (!refreshToken) {
        throw new Error("Twitch refresh token is missing.");
    }

    const response = await fetch(
        "https://id.twitch.tv/oauth2/token",
        {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                client_id:
                    process.env.TWITCH_CLIENT_ID,

                client_secret:
                    process.env.TWITCH_CLIENT_SECRET,

                grant_type:
                    "refresh_token",

                refresh_token:
                    refreshToken
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Twitch token refresh failed."
        );
    }

    accessToken = data.access_token;

    if (data.refresh_token) {
        refreshToken = data.refresh_token;

        console.log(
            "Twitch supplied a new refresh token."
        );

        console.log(
            "Update TWITCH_REFRESH_TOKEN in Railway Variables."
        );
    }

    console.log(
        "Twitch access token refreshed successfully."
    );

    return accessToken;
}

async function twitchRequest(url, retry = true) {
    if (!accessToken) {
        await refreshTwitchToken();
    }

    const response = await fetch(url, {
        headers: {
            Authorization:
                `Bearer ${accessToken}`,

            "Client-Id":
                process.env.TWITCH_CLIENT_ID
        }
    });

    if (response.status === 401 && retry) {
        console.log(
            "Twitch access token expired. Refreshing..."
        );

        await refreshTwitchToken();

        return twitchRequest(
            url,
            false
        );
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            `Twitch API error: ${response.status}`
        );
    }

    return data;
}

async function getBroadcaster() {
    const data = await twitchRequest(
        "https://api.twitch.tv/helix/users"
    );

    if (
        !data.data ||
        data.data.length === 0
    ) {
        throw new Error(
            "Could not find the Twitch account."
        );
    }

    broadcasterId =
        data.data[0].id;

    console.log(
        `Connected Twitch account: ${data.data[0].display_name}`
    );
}

async function getSubscriberCount() {
    if (!broadcasterId) {
        await getBroadcaster();
    }

    const data = await twitchRequest(
        `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${broadcasterId}`
    );

    return data.total;
}

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "index.html"
        )
    );
});

app.get("/style.css", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "style.css"
        )
    );
});

app.get("/script.js", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "script.js"
        )
    );
});

app.get("/auth", (req, res) => {
    const params =
        new URLSearchParams({
            client_id:
                process.env.TWITCH_CLIENT_ID,

            redirect_uri:
                process.env.TWITCH_REDIRECT_URI,

            response_type:
                "code",

            scope:
                "channel:read:subscriptions"
        });

    res.redirect(
        `https://id.twitch.tv/oauth2/authorize?${params.toString()}`
    );
});

app.get(
    "/auth/callback",
    async (req, res) => {
        const {
            code,
            error,
            error_description
        } = req.query;

        if (error) {
            return res
                .status(400)
                .send(
                    `Twitch authorization failed: ${
                        error_description ||
                        error
                    }`
                );
        }

        if (!code) {
            return res
                .status(400)
                .send(
                    "No authorization code received."
                );
        }

        try {
            const response =
                await fetch(
                    "https://id.twitch.tv/oauth2/token",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/x-www-form-urlencoded"
                        },

                        body:
                            new URLSearchParams({
                                client_id:
                                    process.env
                                        .TWITCH_CLIENT_ID,

                                client_secret:
                                    process.env
                                        .TWITCH_CLIENT_SECRET,

                                code,

                                grant_type:
                                    "authorization_code",

                                redirect_uri:
                                    process.env
                                        .TWITCH_REDIRECT_URI
                            })
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                return res
                    .status(400)
                    .send(
                        `Twitch token exchange failed: ${
                            data.message ||
                            "Unknown error"
                        }`
                    );
            }

            accessToken =
                data.access_token;

            refreshToken =
                data.refresh_token;

            await getBroadcaster();

            const count =
                await getSubscriberCount();

            console.log(
                `Current subscriber count: ${count}`
            );

            console.log(
                "IMPORTANT: Add this new refresh token to Railway:"
            );

            console.log(
                refreshToken
            );

            res.send(`
                <h1>Twitch Connected!</h1>
                <p>Authorization successful.</p>
                <p>Current subscribers: ${count}</p>
                <p>You can close this window.</p>
            `);

        } catch (error) {
            console.error(
                "Connection error:",
                error
            );

            res
                .status(500)
                .send(
                    `Something went wrong: ${error.message}`
                );
        }
    }
);

app.get(
    "/api/subscribers",
    async (req, res) => {
        try {
            const count =
                await getSubscriberCount();

            res.json({
                current: count
            });

        } catch (error) {
            console.error(
                "Subscriber count error:",
                error
            );

            res
                .status(500)
                .json({
                    error:
                        error.message
                });
        }
    }
);

app.listen(
    PORT,
    () => {
        console.log(
            "================================="
        );

        console.log(
            "SUBCOUNTER4K SERVER"
        );

        console.log(
            `Running on port ${PORT}`
        );

        console.log(
            `Twitch refresh token configured: ${Boolean(
                refreshToken
            )}`
        );

        console.log(
            "================================="
        );
    }
);