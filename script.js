const counterText = document.getElementById("counter-text");

let currentSubscribers = 0;
let subscriberGoal = 150;

function calculateGoal(current) {
    const step = 25;

    if (current < step) {
        return step;
    }

    return Math.ceil((current + 1) / step) * step;
}

function updateCounter() {
    counterText.textContent = `${currentSubscribers} / ${subscriberGoal}`;
}

async function updateSubscriberCount() {
    try {
        const response = await fetch(
            "http://localhost:3000/api/subscribers"
        );

        if (!response.ok) {
            throw new Error("Failed to get subscriber count.");
        }

        const data = await response.json();

        currentSubscribers = Number(data.current) || 0;

        if (currentSubscribers >= subscriberGoal) {
            subscriberGoal = calculateGoal(currentSubscribers);
        }

        updateCounter();

    } catch (error) {
        console.error(
            "Subscriber count update failed:",
            error
        );
    }
}

updateCounter();
updateSubscriberCount();

setInterval(
    updateSubscriberCount,
    30000
);