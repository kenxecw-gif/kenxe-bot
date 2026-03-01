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
// 🔹 GOOGLE SHEETS SAFE SETUP
// ==============================
let sheets = null;

try {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheets = google.sheets({ version: "v4", auth });

  console.log("Google Sheets connected ✅");

} catch (err) {
  console.log("Google Sheets initialization failed ❌");
  console.log(err.message);
}

// ==============================
let userSessions = {};
// ==============================

// 🔹 WEBHOOK VERIFICATION
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// 🔹 MAIN BOT LOGIC
app.post("/webhook", async (req, res) => {
  console.log("🔥 Webhook POST received");
  console.log("Body:", JSON.stringify(req.body));
  try {
    const body = req.body;

    if (body.object) {
      const message =
        body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (!message) return res.sendStatus(200);

      const from = message.from;
      let text = "";
      let locationLink = "";

      if (message.type === "text") {
        text = message.text?.body?.trim();
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
          reply = "Please tell the reason for cancellation.";
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
      // START
      // ======================
else if (
  text &&
  ["hi", "hello", "start", "menu"].includes(text.toLowerCase())
)
{
  userSessions[from].step = "menu";
  reply =
    "Welcome to Kenxe 🚗\n\n" +
    "1️⃣ One Time Wash\n" +
    "2️⃣ Subscription Plans\n\n" +
    "Reply with number.";
}

      // ======================
      // MENU
      // ======================
      else if (userSessions[from].step === "menu") {
        if (text === "1") {
          reply =
            "Choose Service:\n" +
            "1️⃣ Stranded – ₹399\n" +
            "2️⃣ Premium – ₹499\n" +
            "3️⃣ Diamond – ₹599";
          userSessions[from].step = "service";
        } else if (text === "2") {
          reply =
            "Choose Plan:\n" +
            "1️⃣ Silver – ₹1199\n" +
            "2️⃣ Gold – ₹2199\n" +
            "3️⃣ Platinum – ₹3099";
          userSessions[from].step = "service";
        } else {
          reply = "Reply with 1 or 2.";
        }
      }

      // ======================
      // SERVICE
      // ======================
      else if (userSessions[from].step === "service") {
        userSessions[from].service = text;
        reply = "Send your details (Name, Car, Date & Time).";
        userSessions[from].step = "details";
      }

      // ======================
      // DETAILS
      // ======================
      else if (userSessions[from].step === "details") {
        userSessions[from].details = text;
        reply = "Please share Live Location.";
        userSessions[from].step = "await_location";
      }

      // ======================
      // LOCATION & CONFIRM
      // ======================
      else if (userSessions[from].step === "await_location") {
        if (message.type === "location") {

          reply =
            "Booking Confirmed ✅\n\n" +
            "Service: " + userSessions[from].service + "\n" +
            "Details: " + userSessions[from].details + "\n" +
            "Location: " + locationLink;

          // SAVE TO GOOGLE SHEET
          if (sheets && SHEET_ID) {
            await sheets.spreadsheets.values.append({
              spreadsheetId: SHEET_ID,   // ✅ MUST BE PRESENT
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
          }

          userSessions[from].lastBooking = {
            service: userSessions[from].service,
            details: userSessions[from].details,
            location: locationLink
          };

          userSessions[from].step = "booked";
        } else {
          reply = "Please share Live Location.";
        }
      }

      // ======================
      // CANCEL REASON
      // ======================
      else if (userSessions[from].step === "cancel_reason") {
        reply = "Booking Cancelled.\nReason: " + text;
        delete userSessions[from].lastBooking;
        userSessions[from].step = "start";
      }

      // ======================
      // RESCHEDULE TIME
      // ======================
      else if (userSessions[from].step === "reschedule_time") {
        userSessions[from].lastBooking.details += "\nUpdated: " + text;
        reply = "Booking Rescheduled ✅";
        userSessions[from].step = "booked";
      }

      // ======================
      // SEND WHATSAPP MESSAGE
      // ======================
      if (reply) {
        await axios.post(
          `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: reply }
          },
          {
            headers: {
              Authorization: `Bearer ${TOKEN}`,
              "Content-Type": "application/json"
            }
          }
        );
      }
    }

    res.sendStatus(200);

  } catch (err) {
    console.log("Webhook Error:", err.message);
    res.sendStatus(200);
  }
});

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});






