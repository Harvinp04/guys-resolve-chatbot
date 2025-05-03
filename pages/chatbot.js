console.log("Chatbot page code loaded at top level");

import { getChatResponse } from 'backend/chat.jsw';

$w.onReady(() => {
    console.log("Chatbot page onReady executed");
    console.log("Elements available:", $w("#input4"), $w("#button1"), $w("#chatDisplay"), $w("#loadingAnimation"));

    try {
        $w("#loadingAnimation").hide(); 
        console.log("Hid loadingAnimation");
    } catch (error) {
        console.error("Error hiding loadingAnimation:", error);
    }

    try {
        $w("#chatDisplay").hide(); 
        console.log("Hid chatDisplay");
    } catch (error) {
        console.error("Error hiding chatDisplay:", error);
    }

    try {
        $w("#button1").onClick(async (event) => {
            console.log("Send button clicked");
            const userMessage = $w("#input4").value;
            if (!userMessage) return;
            if (!$w("#chatDisplay").isVisible) {
                $w("#chatDisplay").show();
            }
            let currentChat = $w("#chatDisplay").text || "Chat starts here...";
            $w("#chatDisplay").text = currentChat + "\nYou: " + userMessage;
            $w("#loadingAnimation").show();

            try {
                const response = await getChatResponse(userMessage);
                console.log("Chatbot Response:", response);
                $w("#chatDisplay").text = $w("#chatDisplay").text + "\nBot: " + response;
            } catch (error) {
                console.error("Error:", error);
                $w("#chatDisplay").text = $w("#chatDisplay").text + "\nBot: Oops, something went wrong!";
            } finally {
                $w("#loadingAnimation").hide();
            }

            $w("#input4").value = ""; 
        });
        console.log("Set onClick handler for button1");
    } catch (error) {
        console.error("Error setting onClick handler for button1:", error);
    }
}); 
