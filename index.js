const base64Img = require('base64-img');
const fs = require('fs');
const { Antigate } = require('antigate2');
const { VK } = require('vk-io');
const config = require('./config');

const triggersDir = './triggers/';
const repliesDir = './replies/';

// ANTIGATE
const antigate = new Antigate({ key : config.ANTIGATE_KEY });

// VK
const vk = new VK({
        token: config.VK_TOKEN,
        apiMode: 'parallel_selected'
});

// Captcha handling
vk.setCaptchaHandler(async ({ src }, retry) => {
    const encodedImage = await base64Img.base64Sync(src);
    const key = await antigate.getByBase64(encodedImage);

    try {
        await retry(key);

        console.log('Капча успешно решена');
    } catch (error) {
        console.log('Капча неверная');
    }
});

// Updates
const { updates } = vk;

let replies = {};

// Setup replies
let repliesCount = 0;

fs.readdir(repliesDir, (err, files) => {
    if (err) throw err;
    
    files.forEach(file => {
        if (!file.match(/_/)) {
            repliesCount++;
            let contents = fs.readFileSync(repliesDir + file);
            let trigger = JSON.parse(contents);
            
            replies[trigger.id] = trigger;  
        }
    });
    
    console.log('Loaded', repliesCount, 'replies');
});

// Middleware
updates.use(async (context, next) => {
    // Ignore outbox messages
    if (context.is('message') && context.isOutbox()) {
        return;
    }

    // Seek commands from chat if set
    if (config.CHAT_ID !== null && context.is('message') && context.payload.chat_id !== config.CHAT_ID) {
        return;
    }
    
    if (context.is('message') && context.payload.user_id && replies[context.payload.user_id]) {
            let message = null;
            const trigger = replies[context.payload.user_id];
            
            switch (trigger.messages.type) {
                case 1:
                    message = trigger.messages.list[Math.floor(Math.random() * trigger.messages.list.length)];
                    break;
                case 2:
                    // GOVNO
                    let type = Math.floor(Math.random() * 2);
                    if (type == 1 && trigger.messages.list.length > 0) {
                        message = trigger.messages.list[Math.floor(Math.random() * trigger.messages.list.length)];
                    } else {
                        message = config.MESSAGES[Math.floor(Math.random() * config.MESSAGES.length)];
                    }
                    break;
            }
            
            if (trigger.messages.type > 0) {
                const name = trigger.names[Math.floor(Math.random() * trigger.names.length)];
                context.reply('@id' + trigger.id + ' (' + name + '), ' + message);
            }        
    }

    // Ignore some users
    if (context.is('message') && config.IGNORE_LIST.indexOf(context.payload.user_id) >= 0) {
        return;
    }

    // Pass commands
    try {
        await next();
    } catch (error) {
        console.error('Error:', error);
    }
});

// Setup triggers
let triggersCount = 0;

fs.readdir(triggersDir, (err, files) => {
    if (err) throw err;
    
    files.forEach(file => {
        if (!file.match(/_/)) {
            triggersCount++;
            let contents = fs.readFileSync(triggersDir + file);
            let trigger = JSON.parse(contents);
            
            updates.hear(trigger.triggers, async (context) => {
                const photo = trigger.photos[Math.floor(Math.random() * trigger.photos.length)];
                await context.sendPhoto(photo);
                
                let message = null;
                
                switch (trigger.messages.type) {
                    case 1:
                        message = trigger.messages.list[Math.floor(Math.random() * trigger.messages.list.length)];
                        break;
                    case 2:
                        // GOVNO 2
                        let type = Math.floor(Math.random() * 2);
                        if (type == 1 && trigger.messages.list.length > 0) {
                            message = trigger.messages.list[Math.floor(Math.random() * trigger.messages.list.length)];
                        } else {
                            message = config.MESSAGES[Math.floor(Math.random() * config.MESSAGES.length)];
                        }
                        break;
                }
                
                if (trigger.messages.type > 0) {
                    const name = trigger.names[Math.floor(Math.random() * trigger.names.length)];
                    context.send('@id' + trigger.id + ' (' + name + '), ' + message);
                }
            });
        }
    });
    
    console.log('Loaded', triggersCount, 'triggers');
});

async function run() {
        await vk.updates.startPolling();
        console.log('Polling started');
}

run().catch(console.error);