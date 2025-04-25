import { getChatResponse } from 'backend/chat.jsw';

const Message = {
    channelId: String,
    type: String,
    summary: String,
    participantId: String,
    createdAt: String,
    payload: { text: String }
};

export function onReady() {
    console.log("Chatbox detected:", $w("#myChatbox"));
    $w("#myChatbox").onMessageReceived((message) => {
        console.log("Received message:", message);
        const userMessage = message?.payload?.text || "No message content";
        getChatResponse(userMessage)
            .then((response) => {
                console.log("Chatbot Response:", response);
                $w("#myChatbox").sendMessage({ messageText: response });
            })
            .catch((error) => {
                console.error("Error:", error);
                $w("#myChatbox").sendMessage({ messageText: "Oops, something went wrong!" });
            });
    });
}