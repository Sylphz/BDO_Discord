if (process.version.startsWith("v6")) throw new Error("This Bot requires Node 7v+ because of async/await")

const Discord = require("discord.js")
const express = require("express")
const app = express()
const superagent = require("superagent")

//Config
let INVITE = process.env.INVITE || "", //An Infinite Invite to your discord server.
    GUILD = process.env.GUILD || "", //The ID of the Guild for this invite ^
    OWNER = process.env.OWNER || "", //Your main account id so the bot can notify if it finds an advertiser
    TOKEN = process.env.TOKEN || "", //The user token for your alt,
    ONLYADVERT = process.env.ONLYADVERT || false, //If the bot should notify on every dm or only if it contains an invite link
    APPID = process.env.APPID || "", //APp ID BRO, THis must be of a bot in the guild that you are monitoring
    APPSECRET = process.env.APPSECRET || "",
    APPSCOPE = process.env.APPSCOPE || "guilds.join",
    APPREDIRECT = process.env.APPREDIRECT || ""
//End Config

const client = new Discord.Client({
    messageCacheMaxSize: 1, //Minimize RAM Load
    disabledEvents: ["TYPING_START"] // ^^
})

let loop24H = () => { //The bot will leave then join the guild every 24 hours
    leaveJoin()
    let evade = Math.floor(Math.random() * 100000) - 50000
    let time = 86400000 + evade
    setTimeout(() => loop24H(), time)
}

let wait10 = () => new Promise(resolve => setTimeout(resolve, 10000))

//Begin The Beef
let cachedDMS = []
let sinceLastLJ = 0

//Ready Event
client.on("ready", () => {
    console.log("Started")
    if (client.user.bot) throw new Error("Auto DM Advert Checker only works on User Acounts.")
})
let ranOnce = false
let appReady = () => {
    if (ranOnce) return
    console.log("App Is Ready")
    loop24H()
}

//Message Event
client.on("message", async message => {
    if (message.author.id === client.user.id) return
    if (message.channel.type !== "dm") return
    if (ONLYADVERT && !/discord\.gg\/\w+|bot\.discord\.io\/\w+|discordapp\.com\/invites\/\w+|discord\.me\/\w+/g.test(message.content)) return

    let owner = client.users.get(OWNER)
    let over = Date.now() - sinceLastLJ < 60000 ? "Less than a minute after I joined." : "Out of the blue."
    if (!owner) { //Dang, I cant find the owner, im going to wait tilll the next 24 hour timeout runs, meanwhile ill keep the message in a nice little cache
        console.log("I could not find the owner, caching till next leaveJoin.")
        let msg = {
            content: message.content,
            author: {
                id: message.author.id,
                tag: message.author.tag
            },
            over
        }
        return cachedDMS.push(msg)
    }
    let txt = `Direct message from: **${message.author.tag} (${message.author.id})**\n**Context:** ${over}\n\n**Content:** ${message.content}`
    try {
        await owner.send(txt)
    } catch (err) {
        console.log("I can't DM the OWNER.")
    }
})

//Leave then Join server
let leaveJoin = async() => {
    sinceLastLJ = Date.now()
    let guild = client.guilds.get(GUILD)
    if (!guild) {
        console.log("I'm not in the guild already, re-running.")
        try {
            await acceptInvite()
            return //leaveJoin()
        } catch (err) {
            throw new Error("Invalid INVITE")
        }
    }
    if (guild.ownerID !== OWNER) throw new Error("Please only run this bot if you are the owner of the server.")

    try {
        await guild.leave()
        console.log("Leaving")
        await wait10()
        console.log("Waited 10 Seconds")
        await acceptInvite()
        console.log("Re-Joined")
    } catch (err) {
        return console.log(err)
    }

    let owner = client.users.get(OWNER)
    if (!owner) throw new Error("I joined the guild but I cannot find the you.")
    if (cachedDMS.length > 0) {
        let txt = cachedDMS.map(m => `**${m.author.tag} (${m.author.id})**\n**Context:** ${m.over}\n\n**Content:** ${m.content}`)
        try {
            await owner.send("**Sending Cached DM's**")
            await owner.send(txt)
        } catch (err) {
            console.log("I can't DM the OWNER.")
        }
    }
}

//Login
client.login(TOKEN)


//THe WebServer because Discord Is Mean
const APP = {
    ID: APPID, //This is the ID of your Application
    SECRET: APPSECRET, //This is the Secret of your application
    SCOPE: APPSCOPE,
    REDIRECT: APPREDIRECT
}

let access_token = null
let refresh_token = null

let acceptInvite = () => {
    console.log("trying")
    return new Promise((resolve, reject) => {
        if (!access_token) return console.log("Accept Auth URI First to join the guild.")
        let JOIN_URI = `https://discordapp.com/api/invites/${INVITE}`
        superagent.post(JOIN_URI).set({
            Authorization: `Bearer ${access_token}`
        }).then((response) => {
            resolve()
        }).catch(console.log)
    })
}

const AUTH_QUERY = [
    `client_id=${APP.ID}`,
    `scope=${APP.SCOPE}`,
    `redirect_uri=${APP.REDIRECT}`,
    'response_type=code',
].join('&');

const AUTH_URL = `https://discordapp.com/oauth2/authorize?${AUTH_QUERY}`;

console.log(AUTH_URL)

app.use("/callback", (req, res) => {
    if (req.query.error) return console.log(req.query.error)
    if (!req.query.code) console.log("Req.Code Errored Bad!")
    let code = req.query.code
    res.send("Success!")
    const TOKEN_PARAMS = [
        'grant_type=authorization_code',
        `code=${code}`,
        `client_id=${APP.ID}`,
        `client_secret=${APP.SECRET}`,
        `redirect_uri=${APP.REDIRECT}`,
    ].join('&');

    const TOKEN_URI = `https://discordapp.com/api/oauth2/token?${TOKEN_PARAMS}`

    superagent.post(TOKEN_URI).then(response => {
        if (!response.body.access_token) throw new Error("Didnt get a token from TOKEN_URI")
        access_token = response.body.access_token
        refresh_token = response.body.refresh_token
        console.log("Refresh: " + refresh_token)
        appReady()
    })
})

app.listen(2001, () => console.log("Listening On 2001"))