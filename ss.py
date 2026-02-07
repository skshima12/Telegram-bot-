import requests, time, json, os

# ===== MAIN BOT CONFIG =====
BOT_TOKEN = "8240568393:AAGmPeR7BAYBu2A1_fjkI-l2lkN7ZUdejS4"
BOT_USERNAME = "EXPLOITS_ADMIN_bot"   # without @
IMAGE_URL = "https://i.ibb.co/RGtJwYvy/693b5d6e-f7a9-4a98-85bf-df8e99358e50.jpg"

INSTAGRAM_LINK = "https://www.instagram.com/x2r_satendra_kushwaha"
WHATSAPP_LINK = "https://wa.me/917870282153?text=Hello"
MY_WEB_LINK = "https://skeducation.ct.ws/"

API = f"https://api.telegram.org/bot{BOT_TOKEN}"
GET_UPDATES = f"{API}/getUpdates"
SEND_MSG = f"{API}/sendMessage"
SEND_PHOTO = f"{API}/sendPhoto"

# ===== MEMORY (per user) =====
users = {}
last_update_id = None

def send_text(cid, text, kb=None):
    data = {"chat_id": cid, "text": text, "parse_mode": "HTML"}
    if kb:
        data["reply_markup"] = json.dumps(kb)
    requests.post(SEND_MSG, data=data)

def download_file(file_id):
    r = requests.get(f"{API}/getFile", params={"file_id": file_id}).json()
    file_path = r["result"]["file_path"]
    file_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_path}"
    content = requests.get(file_url).content

    filename = file_path.split("/")[-1]
    with open(filename, "wb") as f:
        f.write(content)

    return filename

print("🤖 Bot running...")

try:
    while True:
        params = {"timeout": 60}
        if last_update_id:
            params["offset"] = last_update_id + 1

        res = requests.get(GET_UPDATES, params=params).json()

        if res.get("ok"):
            for upd in res["result"]:
                last_update_id = upd["update_id"]

                # ---------- MESSAGE ----------
                if "message" in upd:
                    msg = upd["message"]
                    cid = msg["chat"]["id"]
                    text = msg.get("text", "")

                    users.setdefault(cid, {
                        "state": None,
                        "temp_token": None,
                        "temp_name": None,
                        "bots": {},
                        "active_bot": None
                    })

                    # /start
                    if text == "/start":
                        kb = {
                            "inline_keyboard": [
                                [
                                    {"text": "📸 Instagram", "url": INSTAGRAM_LINK},
                                    {"text": "💬 WhatsApp", "url": WHATSAPP_LINK}
                                ],
                                [
                                    {"text": "▶️ Next", "callback_data": "NEXT"}
                                ]
                            ]
                        }
                        requests.post(SEND_PHOTO, data={
                            "chat_id": cid,
                            "photo": IMAGE_URL,
                            "caption": "<b>Welcome</b>\nSkill ही पहचान है ⚙️",
                            "parse_mode": "HTML",
                            "reply_markup": json.dumps(kb)
                        })

                    # WAIT TOKEN
                    elif users[cid]["state"] == "WAIT_TOKEN":
                        token = text.strip()
                        r = requests.get(f"https://api.telegram.org/bot{token}/getMe").json()
                        if r.get("ok"):
                            users[cid]["temp_token"] = token
                            users[cid]["temp_name"] = r["result"]["username"]
                            users[cid]["state"] = "WAIT_CHAT"
                            send_text(cid, f"✅ Bot verified: @{users[cid]['temp_name']}\nअब <b>CHAT ID</b> भेजो")
                        else:
                            send_text(cid, "❌ Invalid token, फिर से भेजो")

                    # WAIT CHAT ID
                    elif users[cid]["state"] == "WAIT_CHAT":
                        chatid = text.strip()
                        name = users[cid]["temp_name"]
                        users[cid]["bots"][name] = {
                            "token": users[cid]["temp_token"],
                            "chat": chatid
                        }
                        users[cid]["state"] = None
                        send_text(cid, f"✅ Saved: @{name}")

                        kb = {"inline_keyboard": []}
                        for b in users[cid]["bots"]:
                            kb["inline_keyboard"].append([
                                {"text": f"🤖 @{b}", "callback_data": f"USE_{b}"}
                            ])
                        send_text(cid, "📂 <b>Your Bots</b>", kb)

                    # BROADCAST MODE
                    elif users[cid]["active_bot"]:
                        b = users[cid]["active_bot"]
                        token = users[cid]["bots"][b]["token"]
                        target = users[cid]["bots"][b]["chat"]

                        # TEXT
                        if text:
                            requests.post(
                                f"https://api.telegram.org/bot{token}/sendMessage",
                                data={"chat_id": target, "text": text}
                            )

                        # PHOTO
                        if "photo" in msg:
                            fid = msg["photo"][-1]["file_id"]
                            requests.post(
                                f"https://api.telegram.org/bot{token}/sendPhoto",
                                data={"chat_id": target, "photo": fid}
                            )

                        # DOCUMENT (ANY FILE)
                        if "document" in msg:
                            file_id = msg["document"]["file_id"]
                            filename = download_file(file_id)

                            with open(filename, "rb") as f:
                                requests.post(
                                    f"https://api.telegram.org/bot{token}/sendDocument",
                                    data={"chat_id": target},
                                    files={"document": f}
                                )
                            os.remove(filename)

                # ---------- CALLBACK ----------
                if "callback_query" in upd:
                    cb = upd["callback_query"]
                    cid = cb["message"]["chat"]["id"]
                    data = cb["data"]

                    if data == "NEXT":
                        kb = {
                            "inline_keyboard": [
                                [
                                    {"text": "🌐 My Web", "url": MY_WEB_LINK},
                                    {"text": "✉️ SMS", "callback_data": "SMS"}
                                ],
                                [
                                    {"text": "🎁 Refer", "callback_data": "REFER"}
                                ]
                            ]
                        }
                        send_text(cid, "<b>Advance Features</b>", kb)

                    elif data == "SMS":
                        users[cid]["state"] = "WAIT_TOKEN"
                        send_text(cid, "🔐 <b>Bot Token भेजो</b>")

                    elif data.startswith("USE_"):
                        botname = data.replace("USE_", "")
                        users[cid]["active_bot"] = botname
                        send_text(cid, f"📣 <b>Broadcast Mode</b>\nActive: @{botname}\nअब text / photo / file भेजो")

                    elif data == "REFER":
                        ref = f"https://t.me/{BOT_USERNAME}?start=ref_{cid}"
                        send_text(cid, f"🔗 <b>Your Referral Link</b>\n{ref}\n\nShare anywhere 🚀")

        time.sleep(0.5)

except KeyboardInterrupt:
    print("\n🛑 Bot stopped safely")