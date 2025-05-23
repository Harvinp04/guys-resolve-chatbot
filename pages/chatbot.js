/* Guys Resolve Chatbot –  (22 May 2025) */

import { getChatResponse }  from 'backend/chat.jsw';
import { recommendBooks }   from 'backend/bookRecommendations.jsw';
import wixLocation          from 'wix-location';

/* ── state ────────────────────────────────────────────── */
let consentGiven       = false;
let chatHistory        = [];      // { _id, from:'user'|'bot', text }
let isFirstInteraction = true;
let crisisShown        = false;   // show crisis message only once

/* ── constants ────────────────────────────────────────── */
const CRISIS_MSG =
  "Emergency & Crisis Situations: If you are in distress, experiencing a crisis, " +
  "or require immediate assistance, do not rely on this Bot. Instead, contact " +
  "Talk Suicide Canada 1-833-456-4566 or dial 911.";

/* ── onReady ─────────────────────────────────────────── */
$w.onReady(() => {
  /* hide chat UI until consent */
  $w('#input4, #sendButton, #loadingAnimation, #repeater1').hide();

  /* render bubbles */
  $w('#repeater1').onItemReady(($item, data, idx) => {
    const isUser = data.from === 'user';

    if (isUser) {
      $item('#userBox').expand();
      $item('#botBox').collapse();
      $item('#userText').text        = data.text;
      $item('#userText').style.color = '#FFFFFF';
    } else {
      $item('#botBox').expand();
      $item('#userBox').collapse();
      $item('#botText').text        = data.text;
      $item('#botText').style.color = '#FFFFFF';
    }

    /* scroll newest bubble into view */
    if (idx === chatHistory.length - 1) {
      $w('#repeater1').scrollToItem(data._id).catch(() => {});
    }
  });

  /* consent buttons */
  $w('#acceptButton').onClick(() => {
    if (!$w('#checkbox1').checked) return;
    consentGiven = true;
    $w('#agreementText, #checkbox1, #acceptButton, #declineButton').collapse();
    $w('#input4, #sendButton').show();
  });

  $w('#declineButton').onClick(() =>
    $w('#agreementText, #checkbox1, #acceptButton, #declineButton, ' +
       '#input4, #sendButton, #repeater1').collapse()
  );

  /* input / send */
  $w('#sendButton').onClick(sendMessage);
  $w('#input4').onKeyPress(e => {
    if (e.key === 'Enter' && !e.shiftKey) sendMessage();
  });
});

/* ── helpers ─────────────────────────────────────────── */

function isBookingIntent(t) {
  t = t.toLowerCase();
  return t.includes('book') && (
    t.includes('appointment') || t.includes('schedule') ||
    t.includes('session')     || t.includes('booking')
  );
}

function isBookRecommendationIntent(t) {
  t = t.toLowerCase();
  return (
    (t.includes('recommend') && t.includes('book')) ||
    t.includes('book recommendations') ||
    t.includes('recommend me books')   ||
    t.includes('suggest books')
  );
}

/* markdown → plain text (strip formatting) */
function sanitize(md = '') {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>+\s+/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .trim();
}

function refreshChat() {
  $w('#repeater1').data = [...chatHistory];
}

function pushUser(text) {
  chatHistory.push({ _id: Date.now().toString(), from: 'user', text: `You:\n${text}` });
  if (chatHistory.length === 1) $w('#repeater1').show();
  refreshChat();
}

function pushBot(text) {
  chatHistory.push({ _id: (Date.now() + 1).toString(), from: 'bot', text });
  refreshChat();
}

/* ── main send flow ──────────────────────────────────── */

async function sendMessage() {
  if (!consentGiven) return;

  const userInput = $w('#input4').value.trim();
  if (!userInput) return;

  $w('#input4').value = '';
  $w('#loadingAnimation').show();
  pushUser(userInput);

  /* booking redirect */
  if (isBookingIntent(userInput)) {
    pushBot("Therapist Bot:\nSure — taking you to our booking page now…");
    $w('#loadingAnimation').hide();
    return wixLocation.to('/book-online');
  }

  /* book recommendations */
  if (isBookRecommendationIntent(userInput)) {
    try {
      const recs = await recommendBooks(userInput);
      if (recs) {
        pushBot("Therapist Bot:\nHere are a few titles you might find helpful:\n\n" + recs);
      } else {
        pushBot("Therapist Bot:\nI couldn't find matching titles. Could you tell me more about the themes you're interested in?");
      }
    } catch (err) {
      console.error('recommendBooks error', err);
      pushBot("Therapist Bot:\nSorry, something went wrong while fetching recommendations.");
    }
    $w('#loadingAnimation').hide();
    return;
  }

  /* AI reply */
  let raw = '';
  try {
    raw = await getChatResponse(userInput, isFirstInteraction);
    isFirstInteraction = false;
  } catch (err) {
    console.error('getChatResponse error', err);
    raw = 'Sorry, something went wrong. Please try again later.';
  }

  let reply = sanitize(raw);
  if (!crisisShown) {
    reply     += '\n\n' + CRISIS_MSG;
    crisisShown = true;
  }

  pushBot("Therapist Bot:\n" + reply);
  $w('#loadingAnimation').hide();
}
