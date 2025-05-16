import { getChatResponse } from 'backend/chat';
import wixLocation from 'wix-location';
import wixData from 'wix-data';

//console.log("Chatbot page code loaded at top level");

function santizeReply(reply) {
    return reply
        .replace(/<[^>]+>/g, "") 
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/_(.*?)_/g, '$1')
        .replace(/^[ \t]*[-*]\s*/gm, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/==([^=]+)==/g, '$1')
        .trim();
}
function appendBotResponse(currentChat, response) {
    let message = `${currentChat}\nBot: ${response}`;
    if (!message.includes("If you’re in crisis, call 911 or a hotline.")) {
        message += "\nIf you’re in crisis, call 911 or a hotline.";
    }
    return message;
}

$w.onReady(() => {
    try {
        $w("#input4, #sendButton, #chatDisplay, #loadingAnimation").hide();
        $w("#chatDisplay").text = "";
    } catch (e) {
        console.error("Error hiding elements:", e);
    }
    $w("#agreementText, #acceptButton, #declineButton, #dataOptIn").show();
    $w("#acceptButton").onClick(() => {
        if (!$w("#dataOptIn").checked) {
            $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "Please consent to data collection to proceed.");
            return;
        }
        $w("#agreementText, #acceptButton, #declineButton, #dataOptIn").hide();
        $w("#input4, #sendButton, #chatDisplay").show();
    });

    $w("#declineButton").onClick(() => wixLocation.to("/"));

    let state = "initial";
    let intakeData = { presentingIssue: "", preferredApproach: "", who5: {} };
    let conversationContext = [];

    async function getResponseFromCSV(userMessage) {
        try {
            const lower = userMessage.toLowerCase().trim();
            const result = await wixData.query("ChatbotTrainingData")
                .contains("userQuery", lower)
                .or(wixData.query("ChatbotTrainingData").contains("intent", lower))
                .find();
            return result.items[0]?.response || null;
        } catch (e) {
            console.error("CSV query error:", e);
            return null;
        }
    }

    async function sendMessage() {
        const userMessage = $w("#input4").value;
        console.log("sendMessage userMessage:", userMessage);
        if (!userMessage) return;

        $w("#sendButton").disable();
        $w("#loadingAnimation").show();
        conversationContext.push({ role: "user", message: userMessage });

        try {
            let current = $w("#chatDisplay").text || "";
            current += (current ? "\n" : "") + "You: " + userMessage;
            $w("#chatDisplay").text = current;
            let response = await getResponseFromCSV(userMessage) || await getChatResponse(userMessage);
            const lower = userMessage.toLowerCase().trim();

            $w("#chatDisplay").text = appendBotResponse(current, response);
        } catch (err) {
            console.error("Bot error:", err);
            $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "Oops, something went wrong!");
        } finally {
            $w("#loadingAnimation").hide();
            $w("#sendButton").enable();
            $w("#input4").value = "";
            $w("#chatDisplay").show();
        }
    }

    $w("#sendButton").onClick(() => {
        console.log("🔘 sendButton clicked");
        sendMessage();
    });

    $w("#input4").onKeyPress((event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            console.log("↵ Enter pressed");
            sendMessage();
        }
    });
});
