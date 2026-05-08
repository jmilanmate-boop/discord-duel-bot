const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1502192691499503707';
const GUILD_ID = '1501930870762901596';
const DUEL_CHANNEL_ID = '1502197825180532786';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const duels = new Map();

// =========================
// COMMANDS
// =========================

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
    .setDescription('Attack another player')
    .addUserOption(option =>
      option
        .setName('player')
        .setDescription('Player to attack')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('endduel')
    .setDescription('Forfeit a duel')
    .addUserOption(option =>
      option
        .setName('player')
        .setDescription('Player in duel')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('example')
    .setDescription('Shows an example duel attack')

].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

// =========================
// REGISTER COMMANDS
// =========================

(async () => {

  try {

    console.log('Registering slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(
        CLIENT_ID,
        GUILD_ID
      ),
      { body: commands }
    );

    console.log('Slash commands registered!');

  } catch (error) {

    console.error(error);
  }

})();

// =========================
// READY
// =========================

client.once('ready', () => {

  console.log(
    `Logged in as ${client.user.tag}`
  );
});

// =========================
// INTERACTIONS
// =========================

client.on(
  Events.InteractionCreate,
  async interaction => {

    if (!interaction.isChatInputCommand()) return;

    // Duel channel only
    if (
      interaction.channelId !==
      DUEL_CHANNEL_ID
    ) {

      return interaction.reply({
        content:
          '⚔ Duels only work in the duel channel!',
        ephemeral: true
      });
    }

    // =========================
    // DUEL
    // =========================

    if (interaction.commandName === 'duel') {

      const challenger = interaction.user;

      const opponent =
        interaction.options.getUser(
          'player'
        );

      if (challenger.id === opponent.id) {

        return interaction.reply({
          content:
            'You cannot duel yourself!',
          ephemeral: true
        });
      }

      if (opponent.bot) {

        return interaction.reply({
          content:
            'You cannot duel bots!',
          ephemeral: true
        });
      }

      const duelId =
        `${challenger.id}-${opponent.id}`;

      const duel = {

        id: duelId,

        player1: {
          id: challenger.id,
          hp: 30
        },

        player2: {
          id: opponent.id,
          hp: 30
        },

        turn:
          Math.random() < 0.5
            ? challenger.id
            : opponent.id
      };

      duels.set(duelId, duel);

      await interaction.reply(`
⚔ NEW DUEL ⚔

${challenger} VS ${opponent}

❤️ Both players start with 30 HP

🎲 <@${duel.turn}> goes first!

Use:
/roll @player
`);
    }

    // =========================
    // ROLL
    // =========================

    if (interaction.commandName === 'roll') {

      const attacker = interaction.user;

      const target =
        interaction.options.getUser(
          'player'
        );

      const duel =
        [...duels.values()].find(d =>

          (
            d.player1.id === attacker.id &&
            d.player2.id === target.id
          ) ||

          (
            d.player2.id === attacker.id &&
            d.player1.id === target.id
          )
        );

      if (!duel) {

        return interaction.reply({
          content:
            'No duel found with that player!',
          ephemeral: true
        });
      }

      if (duel.turn !== attacker.id) {

        return interaction.reply({
          content:
            'It is not your turn!',
          ephemeral: true
        });
      }

      const attackerData =
        duel.player1.id === attacker.id
          ? duel.player1
          : duel.player2;

      const defenderData =
        duel.player1.id === target.id
          ? duel.player1
          : duel.player2;

      // Get server nicknames

      const attackerMember =
        await interaction.guild.members.fetch(attacker.id);

      const defenderMember =
        await interaction.guild.members.fetch(target.id);

      const attackerName =
        `@${attackerMember.displayName}`;

      const defenderName =
        `@${defenderMember.displayName}`;

      // =========================
      // ATTACK ROLL
      // =========================

      let attackRoll =
        Math.floor(Math.random() * 7);

      let damage = attackRoll;

      let specialText = '';

      // MISS

      if (attackRoll === 0) {

        damage = 0;

        specialText =
`💨 You completely missed the attack!`;
      }

      // CRIT

      else if (attackRoll === 6) {

        damage =
          Math.floor(attackRoll * 1.5);

        specialText =
`✨ AMAZING ANGLE!
💥 CRITICAL STRIKE!`;
      }

      // =========================
      // DEFENSE ROLL
      // =========================

      let defenseRoll =
        Math.floor(Math.random() * 7);

      let defenseText = '';

      // Only defend if attack landed

      if (damage > 0) {

        // 0-2 = no effect

        if (
          defenseRoll >= 3 &&
          defenseRoll <= 5
        ) {

          damage -= 1;

          if (damage < 1) {
            damage = 1;
          }

          defenseText =
`🛡 Defense reduced damage by 1!`;
        }

        // Perfect defense

        else if (defenseRoll === 6) {

          damage =
            Math.floor(damage / 2);

          if (damage < 1) {
            damage = 1;
          }

          defenseText =
`🛡 PERFECT DEFENSE!
Damage was halved!`;
        }
      }

      // Apply damage

      defenderData.hp -= damage;

      if (defenderData.hp < 0) {
        defenderData.hp = 0;
      }

      // =========================
      // WIN CONDITION
      // =========================

      if (defenderData.hp <= 0) {

        duels.delete(duel.id);

        return interaction.reply(`
❤️ ${attackerName}'s HP: ${attackerData.hp}

🎲 ${attackerName}'s Roll: ${attackRoll}
🛡 ${defenderName}'s Defense: ${defenseRoll}

${specialText}
${defenseText}

💥 ${target} takes ${damage} damage!
❤️ ${defenderName}'s HP: 0

🏆 ${attacker} WINS THE DUEL!
`);
      }

      // Swap turn

      duel.turn = target.id;

      await interaction.reply(`
❤️ ${attackerName}'s HP: ${attackerData.hp}

🎲 ${attackerName}'s Roll: ${attackRoll}
🛡 ${defenderName}'s Defense: ${defenseRoll}

${specialText}
${defenseText}

💥 ${target} takes ${damage} damage!
❤️ ${defenderName}'s HP: ${defenderData.hp}

👉 It is now ${target}'s turn!

Use:
/roll @player
`);
    }

    // =========================
    // EXAMPLE
    // =========================

    if (interaction.commandName === 'example') {

      return interaction.reply(`
❤️ @MJ's HP: 30

🎲 @MJ's Roll: 6
🛡 @Alineffy's Defense: 4

✨ AMAZING ANGLE!
💥 CRITICAL STRIKE!

🛡 Defense reduced damage by 1!

💥 @Alineffy takes 8 damage!
❤️ @Alineffy's HP: 22

👉 It is now @Alineffy's turn!

Use:
/roll @player
`);
    }

    // =========================
    // END DUEL
    // =========================

    if (interaction.commandName === 'endduel') {

      const player = interaction.user;

      const target =
        interaction.options.getUser(
          'player'
        );

      const duel =
        [...duels.values()].find(d =>

          (
            d.player1.id === player.id &&
            d.player2.id === target.id
          ) ||

          (
            d.player2.id === player.id &&
            d.player1.id === target.id
          )
        );

      if (!duel) {

        return interaction.reply({
          content:
            'No duel found!',
          ephemeral: true
        });
      }

      // Remove duel

      duels.delete(duel.id);

      // Forfeit message

      await interaction.reply(`
🏳️ ${player} has forfeited the duel!

🏆 ${target} wins by surrender!
`);
    }
});

client.login(TOKEN);
