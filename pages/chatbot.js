import { getChatResponse } from 'backend/chat';
import wixLocation from 'wix-location';
import wixData from 'wix-data';

console.log("Chatbot page code loaded at top level"); // Debug

function appendBotResponse(currentChat, response) {
    let message = `${currentChat}\nBot: ${response}`;
    if (!message.includes("If you’re in crisis, call 911 or a hotline.")) {
        message += "\nIf you’re in crisis, call 911 or a hotline.";
    }
    return message;
}

$w.onReady(() => {
    // Hide initial UI elements
    try {
        setTimeout(() => {
            $w("#input4").hide();
            $w("#sendButton").hide();
            $w("#chatDisplay").hide();
            $w("#loadingAnimation").hide();
            $w("#chatDisplay").text = "";
        }, 100);
    } catch (error) {
        console.error("Error hiding chatbot elements:", error);
    }

    // Show consent banner
    $w("#agreementText").show();
    $w("#acceptButton").show();
    $w("#declineButton").show();
    $w("#dataOptIn").show();

    // Consent acceptance
    $w("#acceptButton").onClick(() => {
        if (!$w("#dataOptIn").checked) {
            $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "Please consent to data collection to proceed.");
            return;
        }
        $w("#agreementText").hide();
        $w("#acceptButton").hide();
        $w("#declineButton").hide();
        $w("#dataOptIn").hide();
        $w("#input4").show();
        $w("#sendButton").show();
        $w("#chatDisplay").show();
    });


    $w("#declineButton").onClick(() => {
        wixLocation.to("/");
    });

    let state = "initial";
    let intakeData = { presentingIssue: "", preferredApproach: "", who5: {} };
    let conversationContext = [];

    function getRecentContext() {
        if (conversationContext.length < 2) return "";
        return conversationContext[conversationContext.length - 2].message.toLowerCase();
    }

    async function getResponseFromCSV(userMessage) {
        try {
            const lowerMessage = userMessage.toLowerCase().trim();
            const result = await wixData.query("ChatbotTrainingData")
                .contains("userQuery", lowerMessage)
                .or(wixData.query("ChatbotTrainingData").contains("intent", lowerMessage))
                .find();
            if (result.items.length > 0) return result.items[0].response;
            return null;
        } catch (error) {
            console.error("Error querying ChatbotTrainingData:", error);
            return null;
        }
    }
    $w("#sendButton").onClick(async () => {
        const userMessage = $w("#input4").value;
        if (!userMessage) return;

        $w("#loadingAnimation").show();
        conversationContext.push({ role: "user", message: userMessage });

        try {
            let currentChat = $w("#chatDisplay").text || "";
            if (currentChat) currentChat += "\n";
            currentChat += "You: " + userMessage;
            $w("#chatDisplay").text = currentChat;

            let response = "";
            const lower = userMessage.toLowerCase().trim();

            if (state === "initial") {
                response = (await getResponseFromCSV(userMessage)) || await getChatResponse(userMessage);

                if ((lower.includes("recommend") && lower.includes("book")) ||
                    (lower.includes("recommendation") && lower.includes("book")) ||
                    (lower.includes("book") && (lower.includes("read") || lower.includes("reading")))) {
                    if (intakeData.presentingIssue) {
                        const bookResult = await wixData.query("Books")
                            .contains("relatedIssues", intakeData.presentingIssue.toLowerCase().trim())
                            .find();
                        if (bookResult.items.length > 0) {
                            const book = bookResult.items[0];
                            response = `I recommend reading "${book.title}" by ${book.author}. ${book.summary} ${book.benefit}`;
                        } else {
                            response = "I don't have any book recommendations for that topic at the moment. How else can I assist you?";
                        }
                    } else {
                        response = "I'd be happy to recommend some books! What topic are you interested in?";
                    }

                } else if ((lower.includes("book") && (lower.includes("appointment") || lower.includes("schedule") || lower.includes("session"))) ||
                           (lower.includes("appointment") || lower.includes("schedule") || lower.includes("session"))) {

                    response = "I’ll take you to the booking page to schedule your appointment.";
                    $w("#chatDisplay").text = appendBotResponse(currentChat, response);
                    setTimeout(() => wixLocation.to("/book-online"), 1000);
                    state = "initial";
                    return;

                } else if (lower.includes("what") || lower.includes("concern") || lower.includes("issue")) {
        
                    response = "What is your main concern?";
                    state = "intake_question_1";

                } else if (lower.includes("tool") || lower.includes("exercise")) {
    
                    response = "Options: 1) CBT Anger Log, 2) WHO-5 Well-being Test, 3) Emotion Wheel. Reply with number or 'Skip'.";
                    state = "therapeutic_tools";

                } else {
                    try {
                        const contentResult = await wixData.query("Content")
                            .contains("themes", intakeData.presentingIssue.toLowerCase())
                            .find();
                        if (contentResult.items.length > 0) {
                            const article = contentResult.items[0];
                            response = `I found an article: "${article.title}". Summary: ${article.content.substring(0,200)}... Reply 'Yes' for full content.`;
                            state = "content_integration";
                        }
                    } catch {
                        response = "I can assist with booking, tools, or book recommendations. How can I help?";
                    }
                }
                $w("#chatDisplay").text = appendBotResponse(currentChat, response);

            } else if (state === "intake_question_1") {
                intakeData.presentingIssue = userMessage;
                response = "Preferred approach? (e.g., CBT, mindfulness)";
                state = "intake_question_2";
                $w("#chatDisplay").text = appendBotResponse(currentChat, response);

            } else if (state === "intake_question_2") {
                intakeData.preferredApproach = userMessage;
                response = "Scheduling your appointment now.";
                $w("#chatDisplay").text = appendBotResponse(currentChat, response);
                setTimeout(() => wixLocation.to("/book-online"), 1000);
                state = "initial";

            } else if (state === "content_integration") {
                if (lower === "yes") {
                    const contentResult = await wixData.query("Content")
                        .contains("themes", intakeData.presentingIssue.toLowerCase())
                        .find();
                    const article = contentResult.items[0];
                    response = `Full article: ${article.content}`;
                } else {
                    response = "How else can I help?";
                }
                state = "initial";
                $w("#chatDisplay").text = appendBotResponse(currentChat, response);

            } else if (state === "therapeutic_tools") {
                // Tools branches
                if (lower === "skip") {
                    response = "Okay, how else can I help?";
                    state = "initial";
                } else if (userMessage === "1") {
                    response = "CBT Anger Log: Describe a recent anger... Reply 'Done' when finished.";
                    state = "cbt_anger_log";
                } else if (userMessage === "2") {
                    response = "WHO-5 Q1: I have felt cheerful... Rate 0-5.";
                    state = "who5_question_1";
                } else if (userMessage === "3") {
                    response = "Emotion Wheel: Name your emotion.";
                    state = "emotion_wheel";
                } else {
                    response = "Reply 1,2,3, or 'Skip'.";
                }
                $w("#chatDisplay").text = appendBotResponse(currentChat, response);

            } else if (state === "cbt_anger_log") {
                if (lower === "done") {
                    response = "Great work! How can I assist?";
                    state = "initial";
                } else {
                    response = "Reflect: Was this helpful?";
                }
                $w("#chatDisplay").text = appendBotResponse(currentChat, response);

            } else if (state === "who5_question_1") {
                intakeData.who5.q1 = parseInt(userMessage, 10);
                response = "Q2: I have felt calm and relaxed. Rate 0-5.";
                state = "who5_question_2";
                $w("#chatDisplay").text = appendBotResponse(currentChat, response);
            } else if (state === "who5_question_2") {
                intakeData.who5.q2 = parseInt(userMessage, 10);
                response = "Q3: I have felt active and vigorous. Rate 0-5.";
                state = "who5_question_3";
                $w("#chatDisplay").text = appendBotResponse(currentChat, response);
            } else if (state === "who5_question_3") {
                intakeData.who5.q3 = parseInt(userMessage, 10);
                response = "Q4: I woke up feeling fresh and rested. Rate 0-5.";
                state = "who5_question_4";
                $w("#chatDisplay").text = appendBotResponse(currentChat, response);
            } else if (state === "who5_question_4") {
                intakeData.who5.q4 = parseInt(userMessage, 10);
                response = "Q5: My daily life has been filled with things that interest me. Rate 0-5.";
                state = "who5_question_5";
                $w("#chatDisplay").text = appendBotResponse(currentChat, response);
            } else if (state === "who5_question_5") {
                intakeData.who5.q5 = parseInt(userMessage, 10);
                const score = Object.values(intakeData.who5).reduce((a,b) => a+b, 0);
                response = `Your WHO-5 score is ${score}/25. A score below 13 may indicate low wellbeing. Would you like to book a session? (Yes/No)`;
                state = "therapist_choice";
                $w("#chatDisplay").text = appendBotResponse(currentChat, response);
            } else if (state === "therapist_choice") {
                if (lower === "yes") {
                    response = "Let’s schedule your appointment.";
                    $w("#chatDisplay").text = appendBotResponse(currentChat, response);
                    setTimeout(() => wixLocation.to("/book-online"), 1000);
                } else {
                    response = "Okay, how else can I help?";
                    $w("#chatDisplay").text = appendBotResponse(currentChat, response);
                }
                state = "initial";
            } else if (state === "emotion_wheel") {
                response = `You’re feeling ${userMessage}. What triggered this emotion?`;
                if (lower === "done") {
                    response = "Thank you for sharing. How else can I assist?";
                    state = "initial";
                }
                $w("#chatDisplay").text = appendBotResponse(currentChat, response);
            }

        } catch (error) {
            console.error("Bot error:", error);
            const fallback = appendBotResponse($w("#chatDisplay").text, "Oops, something went wrong!");
            $w("#chatDisplay").text = fallback;
        } finally {
            $w("#loadingAnimation").hide();
            $w("#input4").value = "";
        }
    });
});
