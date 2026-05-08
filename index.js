const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const TOKEN = 'MTUwMjE5MjY5MTQ5OTUwMzcwNw.GeMI_b.XfTyiDHkzqkLNP4OPFJm-T89Ah-3iVPI3Rw_FU';
const CLIENT_ID = '1502192691499503707';
const GUILD_ID = '1501930870762901596';
const DUEL_CHANNEL_ID = '1502197825180532786';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const activeDuels = new Map();

// Slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Challenge someone to a duel!')
    .addUserOption(option =>
      option
        .setName('player')
        .setDescription('Player to duel')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll during your duel!')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

// Register commands
(async () => {
  try {

    console.log('Registering slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log('Slash commands registered!');

  } catch (error) {
    console.error(error);
  }
})();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isChatInputCommand()) return;

  // Restrict to duel channel
  if (interaction.channelId !== DUEL_CHANNEL_ID) {

    return interaction.reply({
      content: '⚔ Duels only work in the duel channel!',
      ephemeral: true
    });
  }

  // =========================
  // DUEL COMMAND
  // =========================

  if (interaction.commandName === 'duel') {

    const challenger = interaction.user;
    const opponent = interaction.options.getUser('player');

    if (opponent.bot) {

      return interaction.reply({
        content: 'You cannot duel bots!',
        ephemeral: true
      });
    }

    if (challenger.id === opponent.id) {

      return interaction.reply({
        content: 'You cannot duel yourself!',
        ephemeral: true
      });
    }

    // Prevent already fighting
    if (
      activeDuels.has(challenger.id) ||
      activeDuels.has(opponent.id)
    ) {

      return interaction.reply({
        content: 'One of these players is already in a duel!',
        ephemeral: true
      });
    }

    // Random first turn
    const currentTurn =
      Math.random() < 0.5
        ? challenger.id
        : opponent.id;

    const duelData = {
      player1: challenger.id,
      player2: opponent.id,
      hp: {
        [challenger.id]: 50,
        [opponent.id]: 50
      },
      turn: currentTurn
    };

    activeDuels.set(challenger.id, duelData);
    activeDuels.set(opponent.id, duelData);

    const startingPlayer =
      currentTurn === challenger.id
        ? challenger
        : opponent;

    await interaction.reply(`
⚔ DUEL STARTED ⚔

${challenger} VS ${opponent}

❤️ Both players start with 50 HP

🎲 ${startingPlayer} goes first!

Use:
/roll
`);
  }

  // =========================
  // ROLL COMMAND
  // =========================

  if (interaction.commandName === 'roll') {

    const player = interaction.user;

    // Check duel
    if (!activeDuels.has(player.id)) {

      return interaction.reply({
        content: 'You are not in a duel!',
        ephemeral: true
      });
    }

    const duel = activeDuels.get(player.id);

    // Check turn
    if (duel.turn !== player.id) {

      return interaction.reply({
        content: 'It is not your turn!',
        ephemeral: true
      });
    }

    const opponentId =
      duel.player1 === player.id
        ? duel.player2
        : duel.player1;

    // Roll d10
    const damage = Math.floor(Math.random() * 10) + 1;

    duel.hp[opponentId] -= damage;

    if (duel.hp[opponentId] < 0) {
      duel.hp[opponentId] = 0;
    }

    // Win condition
    if (duel.hp[opponentId] <= 0) {

      activeDuels.delete(player.id);
      activeDuels.delete(opponentId);

      return interaction.reply(`
🎲 ${player} rolled a ${damage}!

💥 <@${opponentId}> takes ${damage} damage!

❤️ <@${opponentId}> HP: 0

🏆 ${player} WINS THE DUEL!
`);
    }

    // Swap turns
    duel.turn = opponentId;

    await interaction.reply(`
🎲 ${player} rolled a ${damage}!

💥 <@${opponentId}> takes ${damage} damage!

❤️ <@${opponentId}> HP: ${duel.hp[opponentId]}

👉 It is now <@${opponentId}>'s turn!

Use:
/roll
`);
  }
});

client.login(TOKEN);