/**
 * Material Symbols Icon Font URL Generator
 * 
 * Usage: node scripts/generate-icon-font-url.mjs
 * 
 * Add new icons to the ICONS array below, then run the script.
 * It will output the sorted Google Fonts URL.
 */

const ICONS = [
  'ac_unit',
  'account_balance',
  'add',
  'add_photo_alternate',
  'arrow_circle_left',
  'arrow_drop_down',
  'attach_money',
  'autorenew',
  'bar_chart',
  'bar_chart_off',
  'block',
  'bolt',
  'cancel',
  'check',
  'check_indeterminate_small',
  'circle',
  'close',
  'confirmation_number',
  'construction',
  'content_copy',
  'currency_bitcoin',
  'dark_mode',
  'database',
  'delete_forever',
  'deployed_code',
  'download_for_offline',
  'edit',
  'electrical_services',
  'error',
  'euro',
  'flash_off',
  'flowsheet',
  'forum',
  'history',
  'info',
  'key',
  'vpn_key',
  'keyboard_arrow_down',
  'language',
  'light_mode',
  'lock_clock',
  'logout',
  'mail',
  'menu',
  'mode_heat',
  'money_off',
  'more_vert',
  'pageview',
  'password',
  'payments',
  'person',
  'person_add',
  'qr_code_2_add',
  'question_mark',
  'restore',
  'save',
  'save_clock',
  'search',
  'send',
  'settings',
  'smart_toy',
  'sound_detection_dog_barking',
  'star',
  'stop',
  'stylus_note',
  'switch_access_shortcut_add',
  'table',
  'thunderstorm',
  'visibility',
  'visibility_off',
  'warning',
  'wifi_off',
  'vpn_lock_2',
  'spa',
  'credit_score',
  'refresh',
  'add_comment',
  'chat_bubble',
  'chat_bubble_off',
  'tune',
  'graph_4',
  'link',
  'open_in_new',
  'first_page',
  'last_page',
  'chevron_left',
  'chevron_right',
  'arrow_forward',
  'add_circle',
  'date_range',
  'file_save_off',
  'calendar_today',
  'swap_calls',
  'monitor_heart',
  'health_cross',
  'network_intelligence',
  'schedule',
  'task_alt',
  'add_task',
  'open_with',
  'play_circle',
  'merge',
  'home'
];

// Sort alphabetically and remove duplicates
const sorted_icons = [...new Set(ICONS)].sort();

// Build the URL
const base_url = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..700,0..1,0..200';
const icon_param = `&icon_names=${sorted_icons.join(',')}`;
const full_url = base_url + icon_param;

console.log('\n📦 Material Symbols Icon Font URL Generator\n');
console.log(`Total icons: ${sorted_icons.length}\n`);
console.log('Icons (sorted):');
console.log(sorted_icons.join(', '));
console.log('\n---\n');
console.log('Google Fonts URL:\n');
console.log(full_url);
console.log('\n---\n');
console.log('Instructions:');
console.log('1. Open the URL above in your browser');
console.log('2. Copy the woff2 URL from the CSS response');
console.log('3. Download that woff2 file');
console.log('4. Save as: src/client/assets/font/material-symbols-used-variations.woff2');
console.log('');
