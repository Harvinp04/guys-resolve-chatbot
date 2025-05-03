console.log("Chatbot page code loaded at top level"); //debug code

function appendBotResponse(currentChat, response, isInitial = false) {
    let message = `${currentChat}\nBot: `;
    if (isInitial) {
        message += "Hi, I am the Guys Resolve AI bot. ";
    }
    message += `${response}\nIf you’re in crisis, call 911 or a hotline.`;
    return message;
}

import { getChatResponse } from 'backend/chat.jsw';
import wixLocation from 'wix-location';
import wixData from 'wix-data';

$w.onReady(() => {
   // console.log("Chatbot page onReady executed"); //debug code
    //console.log("Elements available:", $w("#input4"), $w("#button1"), $w("#chatDisplay"), $w("#loadingAnimation"), $w("#agreementText"), $w("#acceptButton"), $w("#declineButton"), $w("#dataOptIn")); debug code

    try {
        setTimeout(() => {
            $w("#input4").hide();
            $w("#button1").hide();
            $w("#chatDisplay").hide();
            $w("#loadingAnimation").hide();
            console.log("Hid chatbot elements");
            $w("#chatDisplay").text = "";
        }, 100);
    } catch (error) {
        // debug code console.error("Error hiding chatbot elements:", error); 
    }

    $w("#agreementText").show();
    $w("#acceptButton").show();
    $w("#declineButton").show();
    $w("#dataOptIn").show();

    $w("#acceptButton").onClick(() => {
        if (!$w("#dataOptIn").checked) {
            $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "Please consent to data collection to proceed.");
            return;
        }
        console.log("User accepted agreement");
        $w("#agreementText").hide();
        $w("#acceptButton").hide();
        $w("#declineButton").hide();
        $w("#dataOptIn").hide();
        $w("#input4").show();
        $w("#button1").show();
    });

    $w("#declineButton").onClick(() => {
        console.log("User declined agreement");
        wixLocation.to("/");
    });

    let messageCount = 0;
    let state = "initial";
    let intakeData = { presentingIssue: "", preferredApproach: "" };
    let selectedTherapist = null;
    let availableStaff = [];
    let conversationContext = [];

    async function loadStaff() {
        try {
            const staffResult = await wixData.query("Bookings/Staff")
                .eq("status", "ACTIVE")
                .find();
            availableStaff = staffResult.items.map(staff => ({
                name: staff.name.toLowerCase().trim(),
                id: staff._id,
                rates: staff.name.toLowerCase().trim() === "corey turnbull" ? "$180" :
                       (staff.name.toLowerCase().trim() === "jonah melo" || staff.name.toLowerCase().trim() === "armin ovaisy") ? "$135" : "$50/free",
                specialties: staff.name.toLowerCase().trim() === "corey turnbull" ? ["anger", "performance anxiety"] :
                            staff.name.toLowerCase().trim() === "jonah melo" ? ["relationship issues", "anxiety"] :
                            staff.name.toLowerCase().trim() === "armin ovaisy" ? ["trauma", "stress"] : ["general", "anxiety"],
                approaches: staff.name.toLowerCase().trim() === "corey turnbull" ? ["CBT", "psychodynamic"] :
                            staff.name.toLowerCase().trim() === "jonah melo" ? ["trauma-informed", "CBT"] :
                            staff.name.toLowerCase().trim() === "armin ovaisy" ? ["trauma-informed", "mindfulness"] : ["CBT", "positive psychology"]
            }));
           // console.log("Available Staff:", availableStaff); debug code
        } catch (error) {
            //console.error("Error fetching staff:", error); debug code
        }
    }

    loadStaff();

    function matchTherapist() {
        const issue = intakeData.presentingIssue.toLowerCase().trim();
        const approach = intakeData.preferredApproach.toLowerCase().trim();
        let bestMatch = null;
        let bestScore = 0;

        availableStaff.forEach(staff => {
            let score = 0;
            if (staff.specialties.includes(issue)) score += 2;
            if (approach && staff.approaches.includes(approach)) score += 1;
            if (score > bestScore) {
                bestScore = score;
                bestMatch = staff;
            }
        });

        return bestMatch || availableStaff[0];
    }

    try {
        $w("#button1").onClick(async (event) => {
            console.log("Send button clicked");
            const userMessage = $w("#input4").value;
            if (!userMessage) return;

            $w("#loadingAnimation").show();

            conversationContext.push({ role: "user", message: userMessage });

            try {
                let currentChat = $w("#chatDisplay").text || "";
                if (currentChat) {
                    currentChat += "\n";
                }
                $w("#chatDisplay").text = currentChat + "You: " + userMessage;

                if (state === "initial") {
                    let response = messageCount === 0 ? "Hello! How can I assist you today?" : await getChatResponse(userMessage);
                    console.log("Chatbot Response:", response);

                    if (messageCount === 0) {
                        $w("#chatDisplay").text = appendBotResponse(currentChat + "You: " + userMessage, response, true);
                    } else {
                        if (userMessage.toLowerCase().includes("therapy") && userMessage.toLowerCase().includes("offer") && !userMessage.toLowerCase().includes("you")) {
                            response = "At Guys Resolve, we offer a range of therapy services including cognitive behavioral therapy (CBT), trauma-informed approaches, and more. Our therapists specialize in issues like anger, relationship challenges, and performance anxiety. To learn more or book a session, reply 'Book' to proceed with booking a consultation.";
                        } 
                        else if (userMessage.toLowerCase().includes("book") && (userMessage.toLowerCase().includes("appointment") || userMessage.toLowerCase().includes("consultation") || userMessage.toLowerCase() === "book")) {
                            const staffList = availableStaff.map(staff => `${staff.name.charAt(0).toUpperCase() + staff.name.slice(1)} (${staff.rates})`).join(", ");
                            response = `I can help you book a consultation with one of our therapists at Guys Resolve. Available therapists: ${staffList}. Reply with the therapist's name to proceed.`;
                            state = "therapist_choice";
                        } else if (userMessage.toLowerCase().includes("recommend") && userMessage.toLowerCase().includes("book")) {
                            const bookResult = await wixData.query("Books")
                                .contains("relatedIssues", intakeData.presentingIssue.toLowerCase().trim())
                                .find();
                            if (bookResult.items.length > 0) {
                                const book = bookResult.items[0];
                                response = `I recommend reading "${book.title}" by ${book.author}. ${book.summary} ${book.benefit} You can purchase it here: ${book.affiliateLink}`;
                            } else {
                                response = "I don't have any book recommendations at the moment. How else can I assist you?";
                            }
                        } else if (userMessage.toLowerCase().includes("tool") || userMessage.toLowerCase().includes("exercise")) {
                            response = "I can offer therapeutic tools to help you. Options: 1) CBT Anger Log, 2) WHO-5 Well-being Test, 3) Emotion Wheel. Reply with the number to proceed, or say 'Skip' to continue.";
                            state = "therapeutic_tools";
                        } else if (userMessage.toLowerCase().includes("what") || userMessage.toLowerCase().includes("concern") || userMessage.toLowerCase().includes("issue")) {
                            response = "I can help you better if I understand your needs. What is your main concern? (e.g., anger, relationship issues, performance anxiety)";
                            state = "intake_question_1";
                        } else {
                            try {
                                const contentResult = await wixData.query("Content")
                                    .contains("themes", intakeData.presentingIssue.toLowerCase().trim())
                                    .find();
                                if (contentResult.items.length > 0) {
                                    const article = contentResult.items[0];
                                    response += ` I found an article that might help: "${article.title}". Here's a summary: ${article.content.substring(0, 200)}... Would you like to read more? (Reply 'Yes' to continue)`;
                                    state = "content_integration";
                                }
                            } 
                            catch (error) {
                              //debug code  console.error("Content query failed:", error);
                                response += " I can assist with booking, therapeutic tools, or book recommendations. How can I help you?";
                            }
                        }

                        $w("#chatDisplay").text = appendBotResponse(currentChat + "You: " + userMessage, response);
                    }

                    if (!$w("#chatDisplay").isVisible) {
                        $w("#chatDisplay").show();
                    }

                    messageCount++;
                } else if (state === "therapist_choice") {
                    const therapist = userMessage.toLowerCase().trim();
                    const selected = availableStaff.find(staff => staff.name === therapist);
                    if (selected) {
                        selectedTherapist = selected;
                        const scheduleResult = await wixData.query("Bookings/Schedule")
                            .eq("staffMemberId", selected.id)
                            .ge("startDateTime", new Date())
                            .find();
                       // console.log("Schedule:", scheduleResult.items); //debug code

                        if (scheduleResult.items.length > 0) {
                            const firstSlot = scheduleResult.items[0];
                            $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, `${selected.name.charAt(0).toUpperCase() + selected.name.slice(1)} is available on ${new Date(firstSlot.startDateTime).toLocaleString()}. Would you like to book this slot? (Reply 'Book' to confirm)`);
                            state = "confirm_booking";
                        } else {
                            $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, `Sorry, ${selected.name.charAt(0).toUpperCase() + selected.name.slice(1)} has no available slots right now. Please choose another therapist or try again later.`);
                            state = "therapist_choice";
                        }
                    } else {
                        const staffList = availableStaff.map(staff => `${staff.name.charAt(0).toUpperCase() + staff.name.slice(1)} (${staff.rates})`).join(", ");
                        $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, `Please choose a valid therapist: ${staffList}.`);
                    }
                } else if (state === "confirm_booking") {
                    if (userMessage.toLowerCase() === "book") {
                        $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "Redirecting you to book your consultation...");
                        setTimeout(() => {
                            wixLocation.to("/book-online");
                        }, 1000);
                    } else {
                        $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "Booking cancelled. Would you like to choose another therapist? (Reply with the therapist's name to try again, or 'No' to continue)");
                        state = "therapist_choice";
                    }
                } else if (state === "content_integration") {
                    if (userMessage.toLowerCase() === "yes") {
                        const contentResult = await wixData.query("Content")
                            .contains("themes", intakeData.presentingIssue.toLowerCase().trim())
                            .find();
                        const article = contentResult.items[0];
                        $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, `Here’s the full article: "${article.title}". ${article.content}`);
                    } else {
                        $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "Okay, how can I assist you further?");
                    }
                    state = "initial";
                } else if (state === "therapeutic_tools") {
                    if (userMessage.toLowerCase() === "skip") {
                        $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "Okay, how can I assist you further?");
                        state = "initial";
                    } else if (userMessage === "1") {
                        $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "Here’s a CBT Anger Log exercise: Think of a recent situation that made you angry. Write down what happened, how you felt, and what you did. Then, consider a more constructive response. Reply with your thoughts, and I’ll help you reflect.");
                        state = "cbt_anger_log";
                    } else if (userMessage === "2") {
                        $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "Let’s do the WHO-5 Well-being Test. I’ll ask 5 questions about your well-being over the past 2 weeks. Rate each from 0 (at no time) to 5 (all the time). Ready? 1) I have felt cheerful and in good spirits. Reply with your rating.");
                        state = "who5_question_1";
                    } else if (userMessage === "3") {
                        $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "Here’s an Emotion Wheel exercise: Think about how you’re feeling right now. Start with a basic emotion (e.g., sad, angry, happy), then narrow it down (e.g., sad → lonely → isolated). Share your emotion, and I’ll help you explore it.");
                        state = "emotion_wheel";
                    } else {
                        $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "Please reply with 1, 2, 3, or 'Skip' to continue.");
                    }
                } else if (state === "cbt_anger_log") {
                    $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "Thanks for sharing. Let’s reflect: Was your response helpful, or could a different approach reduce your anger next time? Reply with your thoughts, or say 'Done' to finish.");
                    if (userMessage.toLowerCase() === "done") {
                        state = "initial";
                        $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "Great work! How can I assist you now?");
                    }
                } else if (state === "who5_question_1") {
                    intakeData.who5 = { q1: parseInt(userMessage) };
                    $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "2) I have felt calm and relaxed. Reply with your rating.");
                    state = "who5_question_2";
                } else if (state === "who5_question_2") {
                    intakeData.who5.q2 = parseInt(userMessage);
                    $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "3) I have felt active and vigorous. Reply with your rating.");
                    state = "who5_question_3";
                } else if (state === "who5_question_3") {
                    intakeData.who5.q3 = parseInt(userMessage);
                    $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "4) I woke up feeling fresh and rested. Reply with your rating.");
                    state = "who5_question_4";
                } else if (state === "who5_question_4") {
                    intakeData.who5.q4 = parseInt(userMessage);
                    $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "5) My daily life has been filled with things that interest me. Reply with your rating.");
                    state = "who5_question_5";
                } else if (state === "who5_question_5") {
                    intakeData.who5.q5 = parseInt(userMessage);
                    const score = intakeData.who5.q1 + intakeData.who5.q2 + intakeData.who5.q3 + intakeData.who5.q4 + intakeData.who5.q5;
                    $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, `Your WHO-5 score is ${score}/25. This is a screening tool, not a diagnosis. A score below 13 may indicate low well-being. I recommend discussing this with a therapist. Would you like to book a session? (Reply 'Yes' to proceed)`);
                    state = "therapist_choice";
                } else if (state === "emotion_wheel") {
                    $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, `You’re feeling ${userMessage}. Let’s explore why you might feel this way. What happened to trigger this emotion? Reply with your thoughts, or say 'Done' to finish.`);
                    if (userMessage.toLowerCase() === "done") {
                        state = "initial";
                        $w("#chatDisplay").text = appendBotResponse($w("#chatDisplay").text, "Thanks for exploring your emotions! How can I assist you now?");
                    }
                }
            } catch (error) {
                console.error("Error:", error);
                let currentChat = $w("#chatDisplay").text || "";
                if (currentChat) {
                    currentChat += "\n";
                }
                $w("#chatDisplay").text = appendBotResponse(currentChat + "You: " + userMessage, "Oops, something went wrong!");
            } finally {
                $w("#loadingAnimation").hide();
            }

            $w("#input4").value = "";
        });
        //console.log("Set onClick handler for button1 (programmatic)"); debug code
    } catch (error) {
        //console.error("Error setting onClick handler for button1 (programmatic):", error); debug code
    }
});

export async function button1_click(event) {
   // console.log("Send button clicked (manual)"); debug code
    const userMessage = $w("#input4").value;
    if (!userMessage) return;

    $w("#loadingAnimation").show();

    try {
        const response = await getChatResponse(userMessage);
        console.log("Chatbot Response:", response);

        let currentChat = $w("#chatDisplay").text || "";
        if (currentChat) {
            currentChat += "\n";
        }
        $w("#chatDisplay").text = appendBotResponse(currentChat + "You: " + userMessage, response);

        if (!$w("#chatDisplay").isVisible) {
            $w("#chatDisplay").show();
        }
    } catch (error) {
        console.error("Error:", error);
        let currentChat = $w("#chatDisplay").text || "";
        if (currentChat) {
            currentChat += "\n";
        }
        $w("#chatDisplay").text = appendBotResponse(currentChat + "You: " + userMessage, "Oops, something went wrong!");
    } finally {
        $w("#loadingAnimation").hide();
    }

    $w("#input4").value = "";
}