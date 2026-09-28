'use strict';

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const ids = require('./ids');
const repo = require('./repo');
const render = require('./render');
const config = require('../config');
const { parseDateTimeBR, formatDateTimeBR } = require('../utils/date');
const { editSuccess } = require('../utils/ephemeral');

const { MAX_CHANGES } = repo;

// Permissão de administrador, validada SEMPRE no servidor (o cliente não é confiável).
function isAdmin(interaction) {
  return (
    interaction.inGuild() &&
    interaction.memberPermissions != null &&
    interaction.memberPermissions.has(PermissionFlagsBits.Administrator)
  );
}

// ---------------------------------------------------------------------------
// Modal de criação (aberto pelo slash command /criar-bolao).
// ---------------------------------------------------------------------------
function buildCreateModal() {
  const titulo = new TextInputBuilder()
    .setCustomId(ids.IN_TITULO)
    .setLabel('Título do jogo')
    .setPlaceholder('Ex.: Brasil x Japão ⚽')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(200)
    .setRequired(true);

  const dataJogo = new TextInputBuilder()
    .setCustomId(ids.IN_DATA_JOGO)
    .setLabel('Data e hora do jogo')
    .setPlaceholder('DD/MM/AAAA HH:MM — ex.: 29/06/2026 14:00')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(16)
    .setRequired(true);

  const dataLimite = new TextInputBuilder()
    .setCustomId(ids.IN_DATA_LIMITE)
    .setLabel('Limite para palpitar (opcional)')
    .setPlaceholder('Vazio = até a hora do jogo')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(16)
    .setRequired(false);

  const repeats = new TextInputBuilder()
    .setCustomId(ids.IN_REPEATS)
    .setLabel('Placares repetidos (opcional)')
    .setPlaceholder('Quantas pessoas podem repetir o mesmo placar. Padrão: 3')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(2)
    .setRequired(false);

  const premio = new TextInputBuilder()
    .setCustomId(ids.IN_PREMIO)
    .setLabel('Prêmio por acertador (opcional)')
    .setPlaceholder('Padrão: 1 HC')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(false);

  return new ModalBuilder()
    .setCustomId(ids.CREATE_MODAL)
    .setTitle('Criar bolão')
    .addComponents(
      new ActionRowBuilder().addComponents(titulo),
      new ActionRowBuilder().addComponents(dataJogo),
      new ActionRowBuilder().addComponents(dataLimite),
      new ActionRowBuilder().addComponents(repeats),
      new ActionRowBuilder().addComponents(premio)
    );
}

// Submit do modal de criação: valida tudo, cria o bolão e posta a mensagem viva.
async function handleCreateSubmit(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const titulo = interaction.fields.getTextInputValue(ids.IN_TITULO).trim();
  const dataJogoRaw = interaction.fields.getTextInputValue(ids.IN_DATA_JOGO).trim();
  const dataLimiteRaw = interaction.fields.getTextInputValue(ids.IN_DATA_LIMITE).trim();
  const repeatsRaw = interaction.fields.getTextInputValue(ids.IN_REPEATS).trim();
  const premioRaw = interaction.fields.getTextInputValue(ids.IN_PREMIO).trim();

  if (!titulo) {
    await interaction.editReply('❌ Informe um título para o bolão.');
    return;
  }

  const matchDt = parseDateTimeBR(dataJogoRaw);
  if (!matchDt) {
    await interaction.editReply(
      '❌ Data do jogo inválida. Use **DD/MM/AAAA HH:MM** (ex.: 29/06/2026 14:00).'
    );
    return;
  }

  let deadlineDt = matchDt;
  if (dataLimiteRaw) {
    deadlineDt = parseDateTimeBR(dataLimiteRaw);
    if (!deadlineDt) {
      await interaction.editReply(
        '❌ Data limite inválida. Use **DD/MM/AAAA HH:MM** (ex.: 29/06/2026 13:55).'
      );
      return;
    }
    if (deadlineDt.toMillis() > matchDt.toMillis()) {
      await interaction.editReply('❌ O limite para palpitar não pode ser **depois** do início do jogo.');
      return;
    }
  }

  if (deadlineDt.toMillis() <= Date.now()) {
    await interaction.editReply('❌ Esse horário já passou. Escolha uma data/hora **futura** para o jogo/limite.');
    return;
  }

  let maxRepeats = 3;
  if (repeatsRaw) {
    const n = Number(repeatsRaw);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      await interaction.editReply('❌ "Placares repetidos" deve ser um número inteiro de 1 a 99.');
      return;
    }
    maxRepeats = n;
  }

  const premio = premioRaw || '1 HC';

  // Canal fixo do bolão (configurável por CHANNEL_BOLAO).
  const channelId = config.channels.bolao;
  let channel;
  try {
    channel = await interaction.client.channels.fetch(channelId);
    if (!channel || typeof channel.send !== 'function') throw new Error('canal não é de texto');
  } catch (err) {
    console.error('[bolao] canal do bolão inacessível:', err.message);
    await interaction.editReply(
      `❌ Não consegui acessar o canal do bolão (\`${channelId}\`). Confira o ID e dê ao bot ` +
        'as permissões **Ver Canal** e **Enviar Mensagens** lá.'
    );
    return;
  }

  let bolaoId;
  try {
    bolaoId = await repo.createBolao({
      channelId,
      title: titulo,
      matchAt: matchDt.toJSDate(),
      deadlineAt: deadlineDt.toJSDate(),
      maxRepeats,
      prize: premio,
      createdBy: interaction.user.id,
    });
  } catch (err) {
    console.error('[bolao] erro ao salvar bolão:', err);
    await interaction.editReply('⚠️ Erro ao salvar o bolão. Tente novamente em instantes.');
    return;
  }

  // Objeto em memória só para renderizar a 1ª mensagem (ainda sem message_id).
  const bolaoObj = {
    id: bolaoId,
    channel_id: channelId,
    message_id: null,
    title: titulo,
    match_at: matchDt.toJSDate(),
    deadline_at: deadlineDt.toJSDate(),
    max_repeats: maxRepeats,
    prize: premio,
    status: 'open',
  };

  let message;
  try {
    message = await channel.send(render.liveMessage(bolaoObj, []));
    await repo.setMessageId(bolaoId, message.id);
  } catch (err) {
    console.error('[bolao] erro ao postar/registrar a mensagem do bolão:', err);
    await interaction.editReply(
      '⚠️ O bolão foi criado, mas não consegui postar a mensagem no canal. ' +
        'Confira as permissões do bot no canal do bolão e crie novamente.'
    );
    return;
  }

  await editSuccess(
    interaction,
    `✅ Bolão **${titulo}** criado em <#${channelId}>!\n` +
      `🗓️ Jogo: **${formatDateTimeBR(matchDt)}** • ⏰ Limite: **${formatDateTimeBR(deadlineDt)}**\n` +
      `🎯 Placares repetidos: **${maxRepeats}x** • 🏅 Prêmio: **${premio}**\n${message.url}`
  );
}

// ---------------------------------------------------------------------------
// Botão "Fazer meu palpite" -> abre o modal do placar (pré-preenchido se já palpitou).
// ---------------------------------------------------------------------------
async function handleBetButton(interaction) {
  const bolaoId = ids.parseBolaoId(interaction.customId);
  if (!bolaoId) {
    await interaction.reply({ content: '❌ Bolão inválido.', flags: MessageFlags.Ephemeral });
    return;
  }

  let bolao;
  let current;
  try {
    bolao = await repo.getBolao(bolaoId);
    if (bolao) current = await repo.getBet(bolaoId, interaction.user.id);
  } catch (err) {
    console.error('[bolao] erro ao carregar bolão para o palpite:', err);
    await interaction.reply({
      content: '⚠️ Não consegui carregar o bolão agora. Tente novamente em instantes.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!bolao) {
    await interaction.reply({
      content: '❌ Esse bolão não existe mais.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Pré-checagens só de UX — a regra de verdade é reforçada na transação do placeBet.
  if (render.isClosed(bolao)) {
    await interaction.reply({
      content: '⏰ Os palpites deste bolão já foram **encerrados**.',
      flags: MessageFlags.Ephemeral,
    });
    await refreshMessage(interaction.client, bolaoId);
    return;
  }

  if (current && current.change_count >= MAX_CHANGES) {
    await interaction.reply({
      content:
        `🔒 Você já usou suas **${MAX_CHANGES}** alterações. Seu palpite ` +
        `(**${current.home_score} x ${current.away_score}**) está travado e não pode mais mudar.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const restantes = current ? MAX_CHANGES - current.change_count : MAX_CHANGES;
  const placar = new TextInputBuilder()
    .setCustomId(ids.IN_PLACAR)
    .setLabel('Seu palpite (placar)')
    .setPlaceholder('Ex.: 2x1')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(7)
    .setRequired(true);
  if (current) placar.setValue(`${current.home_score}x${current.away_score}`);

  const modal = new ModalBuilder()
    .setCustomId(ids.palpiteModal(bolaoId))
    .setTitle(current ? `Alterar palpite (restam ${restantes})` : 'Fazer meu palpite')
    .addComponents(new ActionRowBuilder().addComponents(placar));

  await interaction.showModal(modal);
}

// Aceita "2x1", "2 x 1", "2×1" (gols de 0 a 99).
function parsePlacar(input) {
  if (typeof input !== 'string') return null;
  const m = input.trim().match(/^(\d{1,2})\s*[x×]\s*(\d{1,2})$/i);
  if (!m) return null;
  return { home: Number(m[1]), away: Number(m[2]) };
}

// Submit do modal do palpite: grava de forma atômica e atualiza a mensagem viva.
async function handleBetSubmit(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const bolaoId = ids.parseBolaoId(interaction.customId);
  if (!bolaoId) {
    await interaction.editReply('❌ Bolão inválido.');
    return;
  }

  const parsed = parsePlacar(interaction.fields.getTextInputValue(ids.IN_PLACAR));
  if (!parsed) {
    await interaction.editReply('❌ Placar inválido. Use o formato **2x1** (gols de 0 a 99).');
    return;
  }

  // Vínculo: user_id (real) + apelido para exibição (cai pro nome global se não houver nick).
  const nickname =
    (interaction.member && interaction.member.nickname) ||
    interaction.user.displayName ||
    interaction.user.username;

  let result;
  try {
    result = await repo.placeBet({
      bolaoId,
      userId: interaction.user.id,
      nickname,
      home: parsed.home,
      away: parsed.away,
    });
  } catch (err) {
    console.error('[bolao] erro ao registrar palpite:', err);
    await interaction.editReply('⚠️ Ocorreu um erro ao salvar seu palpite. Tente novamente.');
    return;
  }

  const { home, away } = parsed;
  switch (result.status) {
    case 'not_found':
      await interaction.editReply('❌ Esse bolão não está mais disponível.');
      return;
    case 'deadline':
      await interaction.editReply('⏰ O tempo para palpitar já **encerrou**.');
      await refreshMessage(interaction.client, bolaoId);
      return;
    case 'change_limit':
      await interaction.editReply(
        `🔒 Você já usou suas **${MAX_CHANGES}** alterações. Seu palpite ` +
          `(**${result.home} x ${result.away}**) está travado.`
      );
      return;
    case 'repeat_full':
      await interaction.editReply(
        `🚫 O placar **${home} x ${away}** já atingiu o limite de **${result.max}** palpites. ` +
          'Escolha um placar diferente.'
      );
      return;
    case 'unchanged':
      await editSuccess(
        interaction,
        `ℹ️ Seu palpite continua **${home} x ${away}** — nada mudou. ` +
          `(Alterações restantes: **${result.remaining}**.)`
      );
      return;
    case 'changed':
      await editSuccess(
        interaction,
        `✅ Palpite alterado para **${home} x ${away}**! Alterações restantes: **${result.remaining}**.`
      );
      await refreshMessage(interaction.client, bolaoId);
      return;
    case 'created':
      await editSuccess(
        interaction,
        `✅ Palpite registrado: **${home} x ${away}**! Você ainda pode alterá-lo até **${result.remaining}x** ` +
          'antes do limite.'
      );
      await refreshMessage(interaction.client, bolaoId);
      return;
    default:
      await interaction.editReply('⚠️ Não entendi o resultado do palpite. Tente novamente.');
  }
}

// ---------------------------------------------------------------------------
// ADMIN: botão "Colocar/Alterar resultado" -> abre o modal do placar final.
// ---------------------------------------------------------------------------
async function handleResultButton(interaction) {
  const bolaoId = ids.parseBolaoId(interaction.customId);
  if (!bolaoId) {
    await interaction.reply({ content: '❌ Bolão inválido.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: '⛔ Apenas administradores podem definir o resultado.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let bolao;
  try {
    bolao = await repo.getBolao(bolaoId);
  } catch (err) {
    console.error('[bolao] erro ao carregar bolão para o resultado:', err);
    await interaction.reply({
      content: '⚠️ Não consegui carregar o bolão agora. Tente novamente.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!bolao) {
    await interaction.reply({ content: '❌ Esse bolão não existe mais.', flags: MessageFlags.Ephemeral });
    return;
  }

  const jaTemResultado = bolao.result_home != null;
  const input = new TextInputBuilder()
    .setCustomId(ids.IN_RESULTADO)
    .setLabel('Resultado final (placar)')
    .setPlaceholder('Ex.: 2x1')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(7)
    .setRequired(true);
  if (jaTemResultado) input.setValue(`${bolao.result_home}x${bolao.result_away}`);

  const modal = new ModalBuilder()
    .setCustomId(ids.resultModal(bolaoId))
    .setTitle(jaTemResultado ? 'Alterar resultado' : 'Adicionar resultado')
    .addComponents(new ActionRowBuilder().addComponents(input));

  await interaction.showModal(modal);
}

// ADMIN: submit do resultado final -> grava e atualiza a mensagem viva.
async function handleResultSubmit(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const bolaoId = ids.parseBolaoId(interaction.customId);
  if (!bolaoId) {
    await interaction.editReply('❌ Bolão inválido.');
    return;
  }
  if (!isAdmin(interaction)) {
    await interaction.editReply('⛔ Apenas administradores podem definir o resultado.');
    return;
  }

  const parsed = parsePlacar(interaction.fields.getTextInputValue(ids.IN_RESULTADO));
  if (!parsed) {
    await interaction.editReply('❌ Resultado inválido. Use o formato **2x1** (gols de 0 a 99).');
    return;
  }

  try {
    const bolao = await repo.getBolao(bolaoId);
    if (!bolao) {
      await interaction.editReply('❌ Esse bolão não existe mais.');
      return;
    }
    await repo.setResult(bolaoId, parsed.home, parsed.away);
  } catch (err) {
    console.error('[bolao] erro ao salvar o resultado:', err);
    await interaction.editReply('⚠️ Erro ao salvar o resultado. Tente novamente.');
    return;
  }

  await editSuccess(
    interaction,
    `✅ Resultado definido: **${parsed.home} x ${parsed.away}**. ` +
      'Agora clique em **📣 Anunciar vencedores** quando quiser publicar quem ganhou.'
  );
  await refreshMessage(interaction.client, bolaoId);
}

// ADMIN: botão "Anunciar vencedores" -> publica os acertadores no canal do bolão.
async function handleWinnersButton(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const bolaoId = ids.parseBolaoId(interaction.customId);
  if (!bolaoId) {
    await interaction.editReply('❌ Bolão inválido.');
    return;
  }
  if (!isAdmin(interaction)) {
    await interaction.editReply('⛔ Apenas administradores podem anunciar os vencedores.');
    return;
  }

  let bolao;
  let winners;
  try {
    bolao = await repo.getBolao(bolaoId);
    if (!bolao) {
      await interaction.editReply('❌ Esse bolão não existe mais.');
      return;
    }
    if (bolao.result_home == null) {
      await interaction.editReply('⚠️ Defina o **resultado** primeiro (botão 🏁) para poder anunciar os vencedores.');
      return;
    }
    winners = await repo.findWinners(bolaoId, bolao.result_home, bolao.result_away);
  } catch (err) {
    console.error('[bolao] erro ao apurar vencedores:', err);
    await interaction.editReply('⚠️ Erro ao apurar os vencedores. Tente novamente.');
    return;
  }

  const channel = await interaction.client.channels.fetch(bolao.channel_id).catch(() => null);
  if (!channel || typeof channel.send !== 'function') {
    await interaction.editReply('⚠️ Não consegui acessar o canal do bolão para publicar o anúncio.');
    return;
  }

  const score = `${bolao.result_home} x ${bolao.result_away}`;
  let announcement;
  let allowedUsers = [];
  if (winners.length === 0) {
    announcement =
      `📣 **Resultado: ${bolao.title} — ${score}**\n\n` +
      `Ninguém cravou o placar **${score}**. Não houve vencedores desta vez. 😅`;
  } else {
    allowedUsers = winners.map((w) => w.user_id);
    const mentions = winners.map((w) => `<@${w.user_id}>`).join(', ');
    announcement =
      `📣 **Resultado: ${bolao.title} — ${score}**\n\n` +
      `🏆 Vencedor(es) (${winners.length}): ${mentions}\n` +
      `Cada acertador leva **${bolao.prize}**! 🎉`;
  }

  try {
    // allowedMentions: só os vencedores são pingados (nada de @everyone/@here via título).
    await channel.send({ content: announcement, allowedMentions: { users: allowedUsers } });
    await repo.markWinnersAnnounced(bolaoId);
  } catch (err) {
    console.error('[bolao] erro ao publicar o anúncio de vencedores:', err);
    await interaction.editReply('⚠️ Não consegui publicar o anúncio no canal. Verifique as permissões do bot.');
    return;
  }

  await refreshMessage(interaction.client, bolaoId);
  await editSuccess(
    interaction,
    winners.length > 0
      ? `✅ ${winners.length} vencedor(es) anunciado(s) em <#${bolao.channel_id}>.`
      : `✅ Anúncio publicado em <#${bolao.channel_id}> (ninguém acertou o placar).`
  );
}

// Recarrega bolão + palpites e edita a mensagem única do canal.
async function refreshMessage(client, bolaoId) {
  try {
    const bolao = await repo.getBolao(bolaoId);
    if (!bolao || !bolao.message_id) return;
    const channel = await client.channels.fetch(bolao.channel_id);
    if (!channel || typeof channel.messages?.fetch !== 'function') return;
    const message = await channel.messages.fetch(bolao.message_id);
    const bets = await repo.listBets(bolaoId);
    await message.edit(render.liveMessage(bolao, bets));
  } catch (err) {
    console.error('[bolao] falha ao atualizar a mensagem do bolão:', err.message);
  }
}

// Roteadores chamados pelo index.js (customId começa com "bolao:").
async function handleButtonInteraction(interaction) {
  if (interaction.customId.startsWith('bolao:bet:')) return handleBetButton(interaction);
  if (interaction.customId.startsWith('bolao:setresult:')) return handleResultButton(interaction);
  if (interaction.customId.startsWith('bolao:winners:')) return handleWinnersButton(interaction);
  return undefined;
}

async function handleModalInteraction(interaction) {
  if (interaction.customId === ids.CREATE_MODAL) return handleCreateSubmit(interaction);
  if (interaction.customId.startsWith('bolao:palpite:')) return handleBetSubmit(interaction);
  if (interaction.customId.startsWith('bolao:resultmodal:')) return handleResultSubmit(interaction);
  return undefined;
}

module.exports = {
  buildCreateModal,
  handleButtonInteraction,
  handleModalInteraction,
};
