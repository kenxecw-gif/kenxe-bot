const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { google } = require("googleapis");

const app = express();
app.use(bodyParser.json());

// ==============================
// 🔐 ENV VARIABLES
// ==============================

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const SHEET_ID = process.env.SHEET_ID;

// ==============================
// 🔹 GOOGLE SHEETS SETUP
// ==============================

let sheets = null;

try {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheets = google.sheets({ version: "v4", auth });

  console.log("✅ Google Sheets connected");

} catch (err) {

  console.log("❌ Google Sheets initialization failed");
  console.log(err.message);

}

// ==============================
// USER SESSION STORAGE
// ==============================

let userSessions = {};

// ==============================
// WEBHOOK VERIFICATION
// ==============================

app.get("/webhook", (req, res) => {

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);

});

// ==============================
// MAIN BOT LOGIC
// ==============================

app.post("/webhook", async (req, res) => {

  console.log("🔥 Webhook POST received");

  try {

    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;

    let text = "";
    let locationLink = "";

    if (message.type === "text") {
      text = message.text.body.trim();
    }

    if (message.type === "location") {

      const lat = message.location.latitude;
      const lng = message.location.longitude;

      locationLink = `https://www.google.com/maps?q=${lat},${lng}`;

    }

    if (!userSessions[from]) {
      userSessions[from] = { step: "start" };
    }

    let reply = "";

    // ======================
    // CANCEL
    // ======================

    if (text && text.toLowerCase() === "cancel") {

      if (userSessions[from]?.lastBooking) {

        reply =
          "⚠️ Please tell the reason for cancellation.";

        userSessions[from].step = "cancel_reason";

      } else {

        reply = "No active booking found.";

      }

    }

    // ======================
    // RESCHEDULE
    // ======================

    else if (text && text.toLowerCase() === "reschedule") {

      if (userSessions[from]?.lastBooking) {

        reply = "Send new Date & Time.";
        userSessions[from].step = "reschedule_time";

      } else {

        reply = "No active booking found.";

      }

    }

    // ======================
    // START MENU
    // ======================

    else if (
      text &&
      ["hi", "hello", "start", "menu"].includes(text.toLowerCase())
    ) {

      userSessions[from].step = "menu";

      reply =
        "🚗 *Welcome to Kenxe*\n\n" +
        "✨ *Your time, your place – our care*\n\n" +
        "Professional doorstep car wash service.\n\n" +
        "Please choose a service:\n\n" +
        "1️⃣ One Time Wash\n" +
        "2️⃣ Subscription Plans\n\n" +
        "Reply with the number.";

    }

    // ======================
    // MENU
    // ======================

    else if (userSessions[from].step === "menu") {

      if (text === "1") {

        reply =
          "🧼 *Choose Your Service*\n\n" +
          "1️⃣ Stranded Wash – ₹399\n" +
          "2️⃣ Premium Wash – ₹499\n" +
          "3️⃣ Diamond Wash – ₹599\n\n" +
          "Reply with service number.";

        userSessions[from].step = "service";

      }

      else if (text === "2") {

        reply =
          "📅 *Subscription Plans*\n\n" +
          "1️⃣ Silver – ₹1199\n" +
          "2️⃣ Gold – ₹2199\n" +
          "3️⃣ Platinum – ₹3099\n\n" +
          "Reply with plan number.";

        userSessions[from].step = "service";

      }

      else {

        reply = "Reply with *1* or *2*.";

      }

    }

    // ======================
    // SERVICE
    // ======================

    else if (userSessions[from].step === "service") {

      userSessions[from].service = text;

      reply =
        "📋 *Please send your booking details*\n\n" +
        "Name:\n" +
        "Car:\n" +
        "Date & Time:\n\n" +
        "Example:\n" +
        "Name: Sash\n" +
        "Car: Swift\n" +
        "Date & Time: 10 Sep, 10 PM";

      userSessions[from].step = "details";

    }

    // ======================
    // DETAILS
    // ======================

    else if (userSessions[from].step === "details") {

      userSessions[from].details = text;

      reply =
        "📍 *Almost done!*\n\n" +
        "Please share your *Live Location* so our team can reach you.";

      userSessions[from].step = "await_location";

    }

    // ======================
    // LOCATION CONFIRM
    // ======================

    else if (userSessions[from].step === "await_location") {

      if (message.type === "location") {

        reply =
          "✅ *Booking Confirmed!*\n\n" +
          "🚗 *Kenxe Doorstep Car Wash*\n\n" +
          "Service: " + userSessions[from].service + "\n" +
          "Details: " + userSessions[from].details + "\n" +
          "📍 Location: " + locationLink + "\n\n" +
          "✨ *Your time, your place – our care*";

        // SAVE TO GOOGLE SHEETS

        if (sheets && SHEET_ID) {

          await sheets.spreadsheets.values.append({

            spreadsheetId: SHEET_ID,
            range: "Sheet1!A:H",
            valueInputOption: "USER_ENTERED",

            requestBody: {

              values: [[
                "KX-" + Date.now(),
                "Customer",
                userSessions[from].service,
                userSessions[from].details,
                locationLink,
                "Confirmed",
                from,
                new Date().toLocaleString()
              ]]

            }

          });

          console.log("✅ Booking saved to Google Sheet");

        }

        userSessions[from].step = "booked";

      }

      else {

        reply =
          "📍 Please send your *Live Location*.";

      }

    }

    // ======================
    // SEND WHATSAPP MESSAGE
    // ======================

    if (reply) {

      try {

        console.log("📤 Sending WhatsApp reply:", reply);

        await axios.post(
          `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: { body: reply }
          },
          {
            headers: {
              Authorization: `Bearer ${TOKEN}`,
              "Content-Type": "application/json"
            }
          }
        );

        console.log("✅ WhatsApp message sent");

      }

      catch (err) {

        console.log("❌ WhatsApp Send Error:",
          err.response?.data || err.message
        );

      }

    }

    res.sendStatus(200);

  }

  catch (err) {

    console.log("Webhook Error:", err.message);
    res.sendStatus(200);

  }

});

// ==============================
// START SERVER
// ==============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
