/**
 * ============================================================
 * MIYOSHI BOUND — Google Apps Script Backend (backend.js)
 * ============================================================
 * v3: doPost方式に変更（CORSブロック回避）
 * ============================================================
 */

// ── Configuration ─────────────────────────────────────────────
var CONFIG = {
  SPREADSHEET_ID: '1vgi5Kx-IJ62iXOFDLnZZIocEMaA-xdoajqdRx90D4j0',
  SHEET_LOG:      '閲覧ログ',
  SHEET_TEMPLATE: '返信メール本文',
  ADMIN_EMAIL:    'yamaya.since2017@gmail.com',
  SENDER_NAME:    'MIYOSHI BOUND 事務局',
  FORM_FIELDS: {
    name:     '担当者名',
    business: '事業者名',
    email:    'メールアドレス',
    category: '業種・カテゴリ',
    message:  '一言紹介'
  },
  MAX_LOG_ROWS: 50000
};

// ══════════════════════════════════════════════════════════════
// SYSTEM B — TRACKING ENDPOINT（POST方式）
// ══════════════════════════════════════════════════════════════
//
// tracking.js から fetch POST + no-cors で送信される。
// Content-Type: text/plain にすることでプリフライトが発生せず、
// no-cors のままクロスオリジンPOSTが通る。
//
// doGet も残しておく（ブラウザから直接URLを叩いてテストできるように）

function doGet(e) {
  try {
    var params = e.parameter;
    if (!params.shop || !params.type) {
      return textResponse('error: missing parameters');
    }
    var shop = sanitize(params.shop, 64);
    var loc  = sanitize(params.loc  || 'direct', 64);
    var type = sanitize(params.type, 16);
    var sid  = sanitize(params.sid  || '', 64);
    var lang = sanitize(params.lang || '', 16);
    var ua   = '';

    if (type !== 'view' && type !== 'like') {
      return textResponse('error: invalid type');
    }
    appendLog(shop, loc, type, sid, lang, ua);
    return textResponse('ok');
  } catch (err) {
    Logger.log('doGet error: ' + err.toString());
    return textResponse('error: ' + err.toString());
  }
}

function doPost(e) {
  try {
    // tracking.js から JSON文字列で送られてくる
    var params = JSON.parse(e.postData.contents);

    if (!params.shop || !params.type) {
      return textResponse('error: missing parameters');
    }

    var shop = sanitize(params.shop, 64);
    var loc  = sanitize(params.loc  || 'direct', 64);
    var type = sanitize(params.type, 16);
    var sid  = sanitize(params.sid  || '', 64);
    var lang = sanitize(params.lang || '', 16);
    var ua   = ''; // POSTでもuaは除外（特殊文字問題を回避）

    if (type !== 'view' && type !== 'like') {
      return textResponse('error: invalid type');
    }

    appendLog(shop, loc, type, sid, lang, ua);
    return textResponse('ok');

  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return textResponse('error: ' + err.toString());
  }
}

function appendLog(shop, loc, type, sid, lang, ua) {
  var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = getOrCreateSheet(ss, CONFIG.SHEET_LOG);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Shop', 'Location', 'Type', 'Session ID', 'Language', 'User Agent', 'Date', 'Hour']);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 9)
      .setFontWeight('bold')
      .setBackground('#1e1d1b')
      .setFontColor('#FAF9F6');
  }

  var now  = new Date();
  var timestamp = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy年M月d日H時mm分');
  var date = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');
  var hour = Utilities.formatDate(now, 'Asia/Tokyo', 'H');

  sheet.appendRow([timestamp, shop, loc, type, sid, lang, ua, date, hour]);

  if (CONFIG.MAX_LOG_ROWS > 0 && (sheet.getLastRow() - 1) > CONFIG.MAX_LOG_ROWS) {
    archiveOldRows(ss, sheet, (sheet.getLastRow() - 1) - CONFIG.MAX_LOG_ROWS);
  }
}

// ── テキストレスポンス（no-corsでは読めないが送信は成立する）──
function textResponse(msg) {
  return ContentService.createTextOutput(msg)
    .setMimeType(ContentService.MimeType.TEXT);
}

// ══════════════════════════════════════════════════════════════
// SYSTEM A — WELCOME MAIL SYSTEM
// ══════════════════════════════════════════════════════════════

function onFormSubmit(e) {
  try {
    var responses = e.namedValues;
    var applicantName  = getField(responses, CONFIG.FORM_FIELDS.name);
    var businessName   = getField(responses, CONFIG.FORM_FIELDS.business);
    var applicantEmail = getField(responses, CONFIG.FORM_FIELDS.email);
    var category       = getField(responses, CONFIG.FORM_FIELDS.category);
    var messageText    = getField(responses, CONFIG.FORM_FIELDS.message);
    var submittedAt    = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    if (!applicantEmail) return;

    var placeholders = {
      '{{name}}':     applicantName  || 'ご担当者様',
      '{{business}}': businessName   || '（未記入）',
      '{{email}}':    applicantEmail,
      '{{category}}': category       || '（未記入）',
      '{{message}}':  messageText    || '（未記入）',
      '{{date}}':     submittedAt,
      '{{year}}':     new Date().getFullYear().toString()
    };

    var template = loadEmailTemplate();
    var subject  = replacePlaceholders(template.subject, placeholders);
    var body     = replacePlaceholders(template.body,    placeholders);

    GmailApp.sendEmail(applicantEmail, subject, body, {
      name: CONFIG.SENDER_NAME,
      htmlBody: body.replace(/\n/g, '<br>')
    });

    var adminSubject = '【MIYOSHI BOUND】新規申込：' + businessName;
    var adminBody    = buildAdminNotification(applicantName, businessName, applicantEmail, category, messageText, submittedAt);
    GmailApp.sendEmail(CONFIG.ADMIN_EMAIL, adminSubject, adminBody, { name: CONFIG.SENDER_NAME });

  } catch (err) {
    Logger.log('onFormSubmit error: ' + err.toString());
  }
}

function loadEmailTemplate() {
  var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_TEMPLATE);
  if (!sheet) return getDefaultTemplate();

  var data     = sheet.getDataRange().getValues();
  var subject  = data[0] ? String(data[0][0]).trim() : getDefaultTemplate().subject;
  var bodyLines = [];
  for (var i = 2; i < data.length; i++) {
    bodyLines.push(data[i][0] !== null ? String(data[i][0]) : '');
  }
  var body = bodyLines.join('\n');
  return { subject: subject, body: body.trim() ? body : getDefaultTemplate().body };
}

function getDefaultTemplate() {
  return {
    subject: '【MIYOSHI BOUND】お申し込みありがとうございます',
    body: '{{name}} 様\n\nお申し込みを受け付けました。\n事業者名：{{business}}\n受付日時：{{date}}'
  };
}

function buildAdminNotification(name, business, email, category, message, date) {
  return '新規申込通知\n\n担当者名：' + name +
         '\n事業者名：' + business +
         '\nメール：'   + email +
         '\n業種：'     + category +
         '\n受付日時：' + date;
}

// ── Utilities ──────────────────────────────────────────────────

function replacePlaceholders(template, map) {
  var result = template;
  Object.keys(map).forEach(function (key) {
    result = result.split(key).join(map[key]);
  });
  return result;
}

function getField(namedValues, fieldName) {
  if (!namedValues || !fieldName) return '';
  var values = namedValues[fieldName];
  return (values && values.length) ? String(values[0]).trim() : '';
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function sanitize(value, maxLength) {
  if (!value) return '';
  return String(value).replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLength || 255);
}

function archiveOldRows(ss, sheet, rowsToArchive) {
  try {
    var archiveName  = CONFIG.SHEET_LOG + '_archive_' +
                       Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMM');
    var archiveSheet = getOrCreateSheet(ss, archiveName);
    var oldData      = sheet.getRange(2, 1, rowsToArchive, 9).getValues();
    if (archiveSheet.getLastRow() === 0) {
      archiveSheet.getRange(1, 1, 1, 9)
        .setValues(sheet.getRange(1, 1, 1, 9).getValues());
    }
    archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, oldData.length, 9)
      .setValues(oldData);
    sheet.deleteRows(2, rowsToArchive);
  } catch (err) {
    Logger.log('Archive error: ' + err.toString());
  }
}
