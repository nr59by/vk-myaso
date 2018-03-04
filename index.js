const image2base64 = require('image-to-base64');
const fs = require('fs');
const { Antigate } = require('antigate2');
const { VK } = require('vk-io');
const sleep = require('sleep');
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
    console.log('Капча');
    
    const encodedImage = await image2base64(src)
    .then((response) => {
            return response;
        }).catch((error) => {
            console.log(error);
        }
    );
           
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
    
    // Replies
    if (context.is('message') && context.getUserId() && replies[context.getUserId()]) {
        const trigger = replies[context.getUserId()];
        
        if (Math.floor(Math.random() * trigger.messages.probability) == trigger.messages.probability - 1) {
            let message = null;
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
            	await Promise.all([
            		context.setActivity(),
            		sleep.sleep(config.REPLIES_DELAY),
            		context.reply('@id' + trigger.id + ' (' + name + '), ' + message)
            	]);                
            }        
        }
    }

    // Ignore some users
    if (context.is('message') && config.IGNORE_LIST.indexOf(context.getUserId()) >= 0) {
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
let triggers = {};

fs.readdir(triggersDir, (err, files) => {
    if (err) throw err;
    
    files.forEach(file => {
        if (!file.match(/_/)) {
            triggersCount++;
            let contents = fs.readFileSync(triggersDir + file);
            let trigger = JSON.parse(contents);
            
            triggers[trigger.id] = trigger.triggers;
            
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
                    await context.send('@id' + trigger.id + ' (' + name + '), ' + message);
                }
            });
        }
    });
    
    console.log('Loaded', triggersCount, 'triggers');
});

updates.hear('$triggers', async (context) => {
    let message = 'Triggers: \n';
    
    for(let index in triggers) { 
        message += 'https://vk.com/id' + index + ' - ' + triggers[index].join(', ') + '\n';
    }

    await context.reply(message);
});

async function run() {
        await vk.updates.startPolling();
        console.log('Polling started');
}

run().catch(console.error);