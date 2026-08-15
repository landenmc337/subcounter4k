const counterText = document.getElementById("counter-text");

let currentSubscribers = 0;
let subscriberGoal = 150;

const API_BASE =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
        ? "http://localhost:3000"
        : "";

function calculateGoal(current) {
    const step = 25;

    if (current < step) {
        return step;
    }

    return Math.ceil((current + 1) / step) * step;
}

function updateCounter() {
    counterText.textContent =
        `${currentSubscribers} / ${subscriberGoal}`;
}

async function updateSubscriberCount() {
    try {
        const response = await fetch(
            `${API_BASE}/api/subscribers`,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                "Failed to get subscriber count."
            );
        }

        const data = await response.json();

        const newSubscriberCount =
            Number(data.current) || 0;

        currentSubscribers =
            newSubscriberCount;

        if (
            currentSubscribers >=
            subscriberGoal
        ) {
            subscriberGoal =
                calculateGoal(
                    currentSubscribers
                );
        }

        updateCounter();

    } catch (error) {
        console.error(
            "Subscriber count update failed:",
            error
        );
    }
}

updateSubscriberCount();

setInterval(
    updateSubscriberCount,
    30000
);