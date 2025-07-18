<template>
  <div id="app">
    <div class="container">
      <header>
        <h1>AIニュースダイジェスト</h1>
        <p>キーワードに関連する最新ニュースを取得します。</p>
      </header>
      <main>
        <div class="search-box">
          <input 
            v-model="keyword" 
            @keyup.enter="fetchNews" 
            placeholder="検索キーワードを入力 (例: 半導体)"
          />
          <button @click="fetchNews" :disabled="loading">
            <span v-if="!loading">ニュースを取得</span>
            <span v-else>取得中...</span>
          </button>
        </div>

        <div v-if="loading" class="loading-spinner"></div>
        <div v-if="error" class="error-message">{{ error }}</div>

        <div v-if="articles.length > 0" class="articles-list">
          <h2>検索結果: 「{{ lastSearchedKeyword }}」</h2>
          <ul>
            <li v-for="(article, index) in articles" :key="index">
              <h3><a :href="article.url" target="_blank" rel="noopener noreferrer">{{ article.title }}</a></h3>
              <p class="source">{{ article.source.name }} - {{ new Date(article.publishedAt).toLocaleString('ja-JP') }}</p>
              <p class="description">{{ article.description }}</p>
            </li>
          </ul>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const keyword = ref('半導体');
const lastSearchedKeyword = ref('');
const articles = ref<any[]>([]);
const loading = ref(false);
const error = ref('');

const fetchNews = async () => {
  if (!keyword.value) {
    error.value = 'キーワードを入力してください。';
    return;
  }
  loading.value = true;
  error.value = '';
  articles.value = [];
  lastSearchedKeyword.value = keyword.value;

  try {
    const apiKeyFromFrontend = import.meta.env.VITE_GNEWS_API_KEY;
    if (!apiKeyFromFrontend) {
      throw new Error('VITE_GNEWS_API_KEY が.env.localに設定されていません。');
    }

    const response = await fetch('/api/fetch-news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        gnewsApiKey: apiKeyFromFrontend,
        keyword: keyword.value
      })
    });
    
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'ニュースの取得に失敗しました。');
    }
    articles.value = data;

  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
};
</script>

<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f2f5; color: #333; margin: 0; padding: 2rem; }
  #app { max-width: 800px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
  header { text-align: center; border-bottom: 1px solid #eee; padding-bottom: 1.5rem; margin-bottom: 2rem; }
  h1 { color: #1a73e8; }
  .search-box { display: flex; gap: 1rem; margin-bottom: 2rem; }
  .search-box input { flex-grow: 1; padding: 0.75rem; font-size: 1rem; border: 1px solid #ccc; border-radius: 4px; }
  .search-box button { padding: 0.75rem 1.5rem; font-size: 1rem; color: white; background-color: #1a73e8; border: none; border-radius: 4px; cursor: pointer; }
  .search-box button:disabled { background-color: #a0c3f0; }
  .loading-spinner { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #1a73e8; border-radius: 50%; animation: spin 1s linear infinite; margin: 2rem auto; }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .error-message { color: red; background-color: #ffebee; border: 1px solid red; padding: 1rem; border-radius: 4px; }
  .articles-list ul { list-style: none; padding: 0; }
  .articles-list li { border-bottom: 1px solid #eee; padding: 1.5rem 0; }
  .articles-list li:last-child { border-bottom: none; }
  .articles-list h3 a { text-decoration: none; color: #1a73e8; }
  .articles-list h3 a:hover { text-decoration: underline; }
  .source { font-size: 0.9rem; color: #666; }
</style>