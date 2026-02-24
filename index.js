const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// 🔐 REPLACE WITH YOUR NEW PERMANENT TOKEN
const TOKEN = "EAALTvXC5H3gBQZBPs0KKiXtKHZCeJffXzDlwyfSC25ZCquZCEIQ76FLbN0zYr5lA5M86aFoAR8LIZCEK70p1QbsuqlrFiohq0XVJvWtmvIlzLnHZAoZCgiORSdRvExTmbeDcOEmfZA1J17RGfxSV7SfJoeFazINKk1E6ErCsZBGUN3KCGrglPnHzVJhFtkHjZA1547NAZDZD";
const PHONE_NUMBER_ID = "932688436604454";
const VERIFY_TOKEN = "12345";

let userSessions = {};

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
  const body = req.body;

  if (body.object) {
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
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

      // ==============================
      // GLOBAL CANCEL
      // ==============================
      if (text && text.toLowerCase() === "cancel") {

        if (userSessions[from]?.lastBooking) {
          reply = "❗ Please tell us the reason for cancellation.";
          userSessions[from].step = "cancel_reason";
        } else {
          reply = "You don’t have any active booking.";
        }

      }

      // ==============================
      // GLOBAL RESCHEDULE
      // ==============================
      else if (text && text.toLowerCase() === "reschedule") {

        if (userSessions[from]?.lastBooking) {
          reply = "📅 Please send new Date & Time.";
          userSessions[from].step = "reschedule_time";
        } else {
          reply = "You don’t have any active booking.";
        }

      }

      // ==============================
      // START MENU (Only on HI)
      // ==============================
      else if (
        userSessions[from].step === "start" &&
        text &&
        ["hi", "hello", "start", "menu"].includes(text.toLowerCase())
      ) {

        reply =
          "Welcome to *Kenxe* 🚗✨\n" +
          "\"Your Time, Your Place – Our Care\"\n\n" +
          "1️⃣ One Time Wash\n" +
          "2️⃣ Subscription Plans\n\n" +
          "Reply with number.";

        userSessions[from].step = "menu";
      }

      // ==============================
      // MENU SELECTION
      // ==============================
      else if (userSessions[from].step === "menu") {

        if (text === "1") {
          reply =
            "Choose Service:\n" +
            "1️⃣ Stranded – ₹399\n" +
            "2️⃣ Premium – ₹499\n" +
            "3️⃣ Diamond – ₹599";
          userSessions[from].type = "One Time";
          userSessions[from].step = "service";
        }

        else if (text === "2") {
          reply =
            "Choose Plan:\n" +
            "1️⃣ Silver – ₹1199\n" +
            "2️⃣ Gold – ₹2199\n" +
            "3️⃣ Platinum – ₹3099";
          userSessions[from].type = "Subscription";
          userSessions[from].step = "service";
        }

        else {
          reply = "Please reply with 1 or 2.";
        }
      }

      // ==============================
      // SERVICE SELECTED
      // ==============================
      else if (userSessions[from].step === "service") {

        userSessions[from].service = text;

        reply =
          "Please send your booking details (Name, Car, Date & Time).";

        userSessions[from].step = "details";
      }

      // ==============================
      // SAVE TEXT DETAILS
      // ==============================
      else if (userSessions[from].step === "details") {

        if (message.type === "text") {

          userSessions[from].details = text;

          reply = "📍 Please share your Live Location using WhatsApp location feature.";
          userSessions[from].step = "await_location";

        } else {
          reply = "Please send booking details first.";
        }
      }

      // ==============================
      // ACCEPT LIVE LOCATION
      // ==============================
      else if (userSessions[from].step === "await_location") {

        if (message.type === "location") {

          reply =
            "✅ *Booking Confirmed!*\n\n" +
            "🧼 Service: " + userSessions[from].service + "\n\n" +
            "📋 Details: " + userSessions[from].details + "\n\n" +
            "📍 Location: " + locationLink + "\n\n" +
            "Type *cancel* to cancel booking\n" +
            "Type *reschedule* to change date & time\n\n" +
            "Our Kenxe team will contact you shortly 🚗✨";

          userSessions[from].lastBooking = {
            service: userSessions[from].service,
            details: userSessions[from].details,
            location: locationLink
          };

          userSessions[from].step = "booked";

        } else {
          reply = "📍 Please share your Live Location.";
        }
      }

      // ==============================
      // CANCEL REASON
      // ==============================
      else if (userSessions[from].step === "cancel_reason") {

        reply =
          "❌ *Booking Cancelled*\n\n" +
          "Reason: " + text + "\n\n" +
          "We hope to serve you again 🚗✨";

        delete userSessions[from].lastBooking;
        userSessions[from].step = "start";
      }

      // ==============================
      // RESCHEDULE
      // ==============================
      else if (userSessions[from].step === "reschedule_time") {

        userSessions[from].lastBooking.details +=
          "\n📅 Updated Date & Time: " + text;

        reply =
          "✅ *Booking Rescheduled*\n\n" +
          userSessions[from].lastBooking.details;

        userSessions[from].step = "booked";
      }

      // ==============================
      // SEND MESSAGE TO WHATSAPP
      // ==============================
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
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
const { google } = require("googleapis");

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
