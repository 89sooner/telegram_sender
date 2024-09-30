const TelegramBot = require("node-telegram-bot-api");
const { TELEGRAM_BOT_TOKEN, BOT_CHAT_ID } = require("../../config/config");
const {
  handleTodayCommand,
  handleStatsCommand,
  handleStatsPeriodCommand,
  handleSearchCommand,
  handleHelpCommand,
} = require("./commands");
const { checkNewReservations } = require("../db/db");
const cron = require("node-cron");

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
  polling: true,
  request: {
    agentOptions: {
      keepAlive: true,
      family: 4,
    },
  },
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`Received message from chat ID: ${chatId}`);
  bot.sendMessage(
    chatId,
    "펜션 예약 관리 봇입니다. \n\n" + "/help 명령어를 활용하여 예약정보를 관리하세요"
  );
});

bot.onText(/\/today/, async (msg) => {
  const chatId = msg.chat.id;
  await handleTodayCommand(bot, chatId);
});

bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  await handleStatsCommand(bot, chatId);
});

bot.onText(/\/stats (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const period = match[1];
  await handleStatsPeriodCommand(bot, chatId, period);
});

bot.onText(/\/search/, async (msg) => {
  const chatId = msg.chat.id;
  const searchOptions = parseSearchOptions(msg.text);
  await handleSearchCommand(bot, chatId, searchOptions);
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  handleHelpCommand(bot, chatId);
});

function parseSearchOptions(text) {
  const searchOptions = {};
  const commandParts = text.split(" ");
  for (let i = 1; i < commandParts.length; i++) {
    const optionParts = commandParts[i].split(":");
    if (optionParts.length === 2) {
      const optionKey = optionParts[0].trim();
      const optionValue = optionParts[1].trim();
      searchOptions[optionKey] = optionValue;
    }
  }
  return searchOptions;
}

cron.schedule("0 8 * * *", () => {
  handleTodayCommand(bot, BOT_CHAT_ID);
});

cron.schedule("*/30 * * * * *", () => {
  checkNewReservations(bot);
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;
  const sender = msg.from.username || msg.from.first_name || "Unknown";

  console.log(`새 메시지 수신 - 채팅 ID: ${chatId}`);
  console.log(`보낸 사람: ${sender}`);
  console.log(`메시지 내용: ${messageText}`);
  console.log("---");
});

module.exports = bot;
