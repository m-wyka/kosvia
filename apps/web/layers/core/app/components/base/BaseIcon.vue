<script setup lang="ts">
type IconName =
  | 'search'
  | 'check'
  | 'close'
  | 'chevron-down'
  | 'chevron-right'
  | 'chevron-left'
  | 'heart'
  | 'heart-filled'
  | 'star'
  | 'star-filled'
  | 'sparkles'
  | 'match'
  | 'premium'
  | 'molecule'
  | 'flask'
  | 'dupes'
  | 'scan'
  | 'shelf'
  | 'user'
  | 'home'
  | 'compass'
  | 'compare'
  | 'bell'
  | 'alert'
  | 'info'
  | 'plus'
  | 'minus'
  | 'filter'
  | 'arrow-right'
  | 'arrow-up-down'
  | 'menu'
  | 'logout'
  | 'settings'
  | 'trash'
  | 'edit'
  | 'send'
  | 'tag'
  | 'store'
  | 'droplet'
  | 'shield';

withDefaults(defineProps<{ name: IconName; size?: number; strokeWidth?: number }>(), {
  size: 20,
  strokeWidth: 1.6,
});

const paths: Record<IconName, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4.1-4.1',
  check: 'M4 12.5 9 17.5 20 6.5',
  close: 'M6 6 18 18M18 6 6 18',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-right': 'm9 6 6 6-6 6',
  'chevron-left': 'm15 6-6 6 6 6',
  heart:
    'M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.7a4.1 4.1 0 0 1 7.5 2.9C19.5 15.4 12 20 12 20Z',
  'heart-filled':
    'M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.7a4.1 4.1 0 0 1 7.5 2.9C19.5 15.4 12 20 12 20Z',
  star: 'm12 4.5 2.32 4.7 5.18.75-3.75 3.66.89 5.16L12 16.33l-4.64 2.44.89-5.16L4.5 9.95l5.18-.75L12 4.5Z',
  'star-filled':
    'm12 4.5 2.32 4.7 5.18.75-3.75 3.66.89 5.16L12 16.33l-4.64 2.44.89-5.16L4.5 9.95l5.18-.75L12 4.5Z',
  sparkles:
    'M12 3v5M12 16v5M4.5 12h5M14.5 12h5M6.6 6.6l3 3M14.4 14.4l3 3M17.4 6.6l-3 3M9.6 14.4l-3 3',
  match: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  premium: 'M8.5 5h7l3 4.5-6.5 10-6.5-10 3-4.5ZM5.5 9.5h13',
  molecule:
    'M12 3.8 19 7.9v8.2L12 20.2 5 16.1V7.9l7-4.1ZM12 8.7a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z',
  flask:
    'M9.5 3v6.5L5 18a1.5 1.5 0 0 0 1.4 2.2h11.2A1.5 1.5 0 0 0 19 18l-4.5-8.5V3M8 3h8M7.5 14.5h9',
  dupes: 'M8.5 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM15.5 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  scan: 'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16',
  shelf: 'M4 7h16M4 12h16M4 17h16M8 7v5M14 12v5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0',
  home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8.5Z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM15.5 8.5l-2 5-5 2 2-5 5-2Z',
  compare:
    'M9 5H5.5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19H9M15 5h3.5A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5H15M12 3v18',
  bell: 'M18 15V10a6 6 0 1 0-12 0v5l-1.5 3h15L18 15ZM10 21h4',
  alert:
    'M12 8v5M12 16.5v.5M10.3 4.2 2.9 17a1.5 1.5 0 0 0 1.3 2.3h15.6a1.5 1.5 0 0 0 1.3-2.3L13.7 4.2a1.5 1.5 0 0 0-2.6 0Z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.5v.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  filter: 'M4 6h16M7 12h10M10 18h4',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-up-down': 'M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3',
  menu: 'M4 7h16M4 12h16M4 17h16',
  logout: 'M15 5h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3M11 8l-4 4 4 4M7 12h10',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7.7 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3.5a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 5 7.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.6V3.5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z',
  trash: 'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v5M14 11v5',
  edit: 'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3ZM14.5 6.5l3 3',
  send: 'M4.5 12 20 4.5 14.5 20l-2.5-6-7.5-2Z',
  tag: 'M4 11V5a1 1 0 0 1 1-1h6l9 9-7 7-9-9ZM8 8.5v.01',
  store: 'M4 9h16M4 9 5.5 4.5h13L20 9M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 20v-5h4v5',
  droplet: 'M12 3.5s6 6.3 6 10.2A6 6 0 0 1 6 13.7C6 9.8 12 3.5 12 3.5Z',
  shield: 'M12 3.5 5 6v5.5c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6l-7-2.5ZM9 12l2 2 4-4',
};
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="name === 'heart-filled' || name === 'star-filled' ? 'currentColor' : 'none'"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="shrink-0"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="paths[name]" />
  </svg>
</template>
