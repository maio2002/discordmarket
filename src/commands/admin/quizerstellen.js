const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quiz-erstellen')
    .setDescription('Erstelle ein Quiz und füge direkt die erste Frage hinzu')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_quiz_erstellen')
      .setTitle('Neues Quiz erstellen');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('titel')
          .setLabel('Quiz-Name')
          .setPlaceholder('z.B. Grundlagen-Test')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('question')
          .setLabel('Erste Frage')
          .setPlaceholder('z.B. Was ist die Hauptstadt von Deutschland?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(300)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('option_a')
          .setLabel('Antwort A')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('option_b')
          .setLabel('Antwort B')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('option_c_correct')
          .setLabel('Antwort C (optional) | Richtig: A, B oder C')
          .setPlaceholder('C: London | Richtig: A  →  oder leer lassen wenn nur A und B')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(120)
      ),
    );

    return interaction.showModal(modal);
  },
};
