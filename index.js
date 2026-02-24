const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// 🔐 PASTE YOUR VALUES HERE
const TOKEN = "EAALTvXC5H3gBQZBPs0KKiXtKHZCeJffXzDlwyfSC25ZCquZCEIQ76FLbN0zYr5lA5M86aFoAR8LIZCEK70p1QbsuqlrFiohq0XVJvWtmvIlzLnHZAoZCgiORSdRvExTmbeDcOEmfZA1J17RGfxSV7SfJoeFazINKk1E6ErCsZBGUN3KCGrglPnHzVJhFtkHjZA1547NAZDZD";
const PHONE_NUMBER_ID = "932688436604454";
const VERIFY_TOKEN = "12345";   // Make sure this matches Meta webhook

// Store user sessions
let userSessions = {};

// 🔹 WEBHOOK VERIFICATION
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified!");
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
      const text = message.text?.body;

      if (!userSessions[from]) {
        userSessions[from] = { step: "start" };
      }

      let reply = "";

      // STEP 1 – Show Menu
      if (userSessions[from].step === "start") {
        reply = "Welcome to *Kenxe* 🚗✨\n\"Your Time, Your Place – Our Care\"\n\n1️⃣ One Time Wash\n2️⃣ Subscription Plans\n\nReply with number.";
        userSessions[from].step = "menu";
      }

      // STEP 2 – Choose Type
      else if (userSessions[from].step === "menu") {
        if (text === "1") {
          reply = "Choose Service:\n1️⃣ Stranded – ₹399\n2️⃣ Premium – ₹499\n3️⃣ Diamond – ₹599";
          userSessions[from].type = "One Time";
          userSessions[from].step = "service";
        } else if (text === "2") {
          reply = "Choose Plan:\n1️⃣ Silver – ₹1199\n2️⃣ Gold – ₹2199\n3️⃣ Platinum – ₹3099";
          userSessions[from].type = "Subscription";
          userSessions[from].step = "service";
        } else {
          reply = "Please reply with 1 or 2.";
        }
      }

     // STEP 3 – Ask Name
else if (userSessions[from].step === "service") {
  userSessions[from].service = text;
  reply = "Please enter your Name:";
  userSessions[from].step = "name";
}

// STEP 4 – Save Name & Ask Car Type
else if (userSessions[from].step === "name") {
  userSessions[from].name = text;
  reply = "Enter your Car Type (Eg: Swift, i20, SUV, Sedan):";
  userSessions[from].step = "car";
}

// STEP 5 – Save Car Type & Ask Date & Time
else if (userSessions[from].step === "car") {
  userSessions[from].car = text;
  reply = "Enter Preferred Date & Time (Example: 25/02/2026 - 10:30 AM):";
  userSessions[from].step = "datetime";
}

// STEP 6 – Save DateTime & Ask Location
else if (userSessions[from].step === "datetime") {
  userSessions[from].datetime = text;
  reply = "Please share your Live Location or type your Address:";
  userSessions[from].step = "location";
}

// STEP 7 – Final Confirmation
else if (userSessions[from].step === "location") {
  userSessions[from].location = text;

  reply = `✅ *Booking Confirmed!*\n
👤 Name: ${userSessions[from].name}
🚗 Car Type: ${userSessions[from].car}
🧼 Service: ${userSessions[from].service}
📅 Date & Time: ${userSessions[from].datetime}
📍 Location: ${userSessions[from].location}

Our Kenxe team will contact you shortly 🚗✨
"Your Time, Your Place – Our Care"`;

  userSessions[from].step = "done";
}
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
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});




