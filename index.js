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
    const message =
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body?.trim();

      if (!userSessions[from]) {
        userSessions[from] = { step: "start" };
      }

      let reply = "";

      // STEP 1 – Main Menu
      if (userSessions[from].step === "start") {
        reply =
          "Welcome to *Kenxe* 🚗✨\n" +
          "\"Your Time, Your Place – Our Care\"\n\n" +
          "1️⃣ One Time Wash\n" +
          "2️⃣ Subscription Plans\n\n" +
          "Reply with number.";
        userSessions[from].step = "menu";
      }

      // STEP 2 – Choose Type
      else if (userSessions[from].step === "menu") {
        if (text === "1") {
          reply =
            "Choose Service:\n" +
            "1️⃣ Stranded – ₹399\n" +
            "2️⃣ Premium – ₹499\n" +
            "3️⃣ Diamond – ₹599";
          userSessions[from].type = "One Time";
          userSessions[from].step = "service";
        } else if (text === "2") {
          reply =
            "Choose Plan:\n" +
            "1️⃣ Silver – ₹1199\n" +
            "2️⃣ Gold – ₹2199\n" +
            "3️⃣ Platinum – ₹3099";
          userSessions[from].type = "Subscription";
          userSessions[from].step = "service";
        } else {
          reply = "Please reply with 1 or 2.";
        }
      }

      // STEP 3 – Ask For Combined Details
      else if (userSessions[from].step === "service") {
        userSessions[from].service = text;

        reply =
          "Please send your booking details in this format:\n\n" +
          "Name:\n" +
          "Car Name:\n" +
          "Date & Time:\n" +
          "Live Location:";

        userSessions[from].step = "details";
      }

      // STEP 4 – Save Text Details (Flexible)
else if (userSessions[from].step === "details") {

  if (message.type === "text") {

    userSessions[from].details = text;

    reply = "📍 Please share your Live Location using WhatsApp location feature.";
    userSessions[from].step = "await_location";

  } else {
    reply = "Please send your booking details first (Name, Car, Date & Time).";
  }
}

// STEP 5 – Accept Real WhatsApp Location
else if (userSessions[from].step === "await_location") {

  if (message.type === "location") {

    const lat = message.location.latitude;
    const lng = message.location.longitude;

    const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;

    reply =
      "✅ *Booking Confirmed!*\n\n" +
      "🧼 Service: " + userSessions[from].service + "\n\n" +
      "📋 Details: " + userSessions[from].details + "\n\n" +
      "📍 Location: " + mapsLink + "\n\n" +
      "Our Kenxe team will contact you shortly 🚗✨\n" +
      "\"Your Time, Your Place – Our Care\"";

    userSessions[from] = { step: "start" };

  } else {
    reply = "📍 Please share your Live Location using WhatsApp location share.";
  }
}

      await axios.post(
        `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply },
        },
        {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
    }
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

