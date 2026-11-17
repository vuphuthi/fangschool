import {createApp} from 'vue';
import Access from './Access.vue';

const root = document.getElementById('access-app');
createApp(Access, {mode: root.dataset.mode}).mount(root);
