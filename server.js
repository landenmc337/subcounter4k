const express = require("express");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config({
    path: path.join(__dirname, "server", ".env")
});

const app = express();
const PORT = process.env.PORT || 3000;

const TOKEN_FILE = path.join(
    __dirname,
    "server",
    "twitch-token.json"
);

let twitchToken = null;
let broadcasterId = null;

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
});

function saveToken(tokenData) {
    fs.writeFileSync(
        TOKEN_FILE,
        JSON.stringify(tokenData, null, 2),
        "utf8"
    );

    twitchToken = tokenData;
}

function loadToken() {
    if (!fs.existsSync(TOKEN_FILE)) {
        return false;
    }

    try {
        twitchToken = JSON.parse(
            fs.readFileSync(TOKEN_FILE, "utf8")
        );

        return true;
    } catch (error) {
        console.error("Could not read Twitch token:", error);
        return false;
    }
}

async function twitchRequest(url, options = {}) {
    if (!twitchToken?.access_token) {
        throw new Error("Twitch is not connected.");
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${twitchToken.access_token}`,
            "Client-Id": process.env.TWITCH_CLIENT_ID,
            ...(options.headers || {})
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || `Twitch API error: ${response.status}`
        );
    }

    return data;
}

async function getBroadcaster() {
    const data = await twitchRequest(
        "https://api.twitch.tv/helix/users"
    );

    if (!data.data || data.data.length === 0) {
        throw new Error("Could not find the Twitch account.");
    }

    broadcasterId = data.data[0].id;

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
        path.join(__dirname, "index.html")
    );
});

app.get("/style.css", (req, res) => {
    res.sendFile(
        path.join(__dirname, "style.css")
    );
});

app.get("/script.js", (req, res) => {
    res.sendFile(
        path.join(__dirname, "script.js")
    );
});

app.get("/auth", (req, res) => {
    const params = new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        redirect_uri: process.env.TWITCH_REDIRECT_URI,
        response_type: "code",
        scope: "channel:read:subscriptions"
    });

    res.redirect(
        `https://id.twitch.tv/oauth2/authorize?${params.toString()}`
    );
});

app.get("/auth/callback", async (req, res) => {
    const {
        code,
        error,
        error_description
    } = req.query;

    if (error) {
        return res.status(400).send(
            `Twitch authorization failed: ${
                error_description || error
            }`
        );
    }

    if (!code) {
        return res.status(400).send(
            "No authorization code received."
        );
    }

    try {
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

                    code,

                    grant_type:
                        "authorization_code",

                    redirect_uri:
                        process.env.TWITCH_REDIRECT_URI
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "Twitch token error:",
                data
            );

            return res.status(400).send(
                `Twitch token exchange failed: ${
                    data.message || "Unknown error"
                }`
            );
        }

        saveToken(data);

        await getBroadcaster();

        const subscriberCount =
            await getSubscriberCount();

        console.log(
            `Current subscriber count: ${subscriberCount}`
        );

        res.send(`
            <h1>Twitch Connected!</h1>
            <p>Authorization successful.</p>
            <p>Current subscribers: ${subscriberCount}</p>
            <p>You can close this window.</p>
        `);

    } catch (error) {
        console.error(
            "Connection error:",
            error
        );

        res.status(500).send(
            `Something went wrong: ${error.message}`
        );
    }
});

app.get("/api/subscribers", async (req, res) => {
    try {
        const subscriberCount =
            await getSubscriberCount();

        res.json({
            current: subscriberCount
        });

    } catch (error) {
        console.error(
            "Subscriber count error:",
            error
        );

        res.status(500).json({
            error: error.message
        });
    }
});

loadToken();

app.listen(PORT, () => {
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
        `Twitch connected: ${Boolean(twitchToken)}`
    );

    console.log(
        "================================="
    );
});