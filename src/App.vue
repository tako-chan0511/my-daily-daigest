<template>
  <div id="app">
    <div class="top-bar">
      <h1>AIニュースダイジェスト</h1>
      <div class="search-box">
        <input 
          v-model="keyword" 
          @keyup.enter="fetchNews" 
          placeholder="検索キーワード (例: 半導体)"
        />
        <button @click="fetchNews" :disabled="loading.news">
          <span v-if="!loading.news">ニュースを取得</span>
          <span v-else>取得中...</span>
        </button>
      </div>
    </div>
    
    <div class="main-content">
      <div class="pane article-list-pane">
        <h2 class="pane-title">検索結果</h2>
        <div v-if="loading.news" class="loading-spinner"></div>
        <div v-if="error.news" class="error-message">{{ error.news }}</div>
        <ul v-if="articles.length > 0">
          <li v-for="(article, index) in articles" 
              :key="index" 
              @click="selectArticle(article)"
              :class="{ 'selected': selectedArticle?.url === article.url }">
            <h3>{{ article.title }}</h3>
            <p class="source">
        {{ article.source.name }} - 
        <a :href="article.source.url" target="_blank" rel="noopener noreferrer" @click.stop>
          {{ article.source.url }}
        </a>
      </p>          </li>
        </ul>
        <div v-if="!loading.news && articles.length === 0 && lastSearchedKeyword" class="placeholder">
          「{{ lastSearchedKeyword }}」に関するニュースは見つかりませんでした。
        </div>
      </div>

      <div class="pane article-content-pane">
        <h2 class="pane-title">記事本文</h2>
        <div v-if="loading.content" class="loading-spinner"></div>
        <div v-if="error.content" class="error-message">{{ error.content }}</div>
        <div v-if="selectedArticleContent" class="article-body" v-html="selectedArticleContent.replace(/\n/g, '<br>')"></div>
        <div v-if="!selectedArticle && !loading.content" class="placeholder">
          ← 記事を選択すると、ここに本文が表示されます
        </div>
      </div>

      <div class="pane ai-assistant-pane">
        <h2 class="pane-title">AIアシスタント</h2>
        <div v-if="loading.summary || loading.answer" class="loading-spinner"></div>
        <div v-if="error.summary" class="error-message">{{ error.summary }}</div>
        
        <div v-if="summaryResult" class="ai-section">
          <h3>AIによる3行要約</h3>
          <div class="summary-result" v-html="summaryResult.replace(/\n/g, '<br>')"></div>
        </div>

        <div v-if="selectedArticle" class="ai-section follow-up-section">
          <h3>記事への質問</h3>
          <div class="question-form">
            <textarea v-model="followUpQuestion" placeholder="記事の内容について質問を入力..." rows="3"></textarea>
            <button @click="askQuestion" :disabled="loading.answer">質問する</button>
          </div>
          <div v-if="error.answer" class="error-message">{{ error.answer }}</div>
          <div v-if="qaHistory.length > 0" class="qa-history">
            <h4>対話履歴</h4>
            <div v-for="(item, index) in qaHistory" :key="index" class="qa-item">
              <p class="question"><strong>Q:</strong> {{ item.question }}</p>
              <p class="answer"><strong>A:</strong> {{ item.answer }}</p>
            </div>
          </div>
        </div>

        <div v-if="!selectedArticle && !loading.summary && !loading.answer" class="placeholder">
          ← 記事を選択すると、ここにAIの分析が表示されます
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const keyword = ref('半導体');
const lastSearchedKeyword = ref('');
const articles = ref<any[]>([]);
const loading = reactive({ news: false, content: false, summary: false, answer: false });
const error = reactive({ news: '', content: '', summary: '', answer: '' });
const selectedArticle = ref<any>(null);
const selectedArticleContent = ref('');
const summaryResult = ref('');
const followUpQuestion = ref('');
const qaHistory = ref<{ question: string, answer: string }[]>([]);

const fetchNews = async () => {
  if (!keyword.value) {
    error.news = 'キーワードを入力してください。';
    return;
  }
  loading.news = true;
  error.news = '';
  articles.value = [];
  selectedArticle.value = null;
  selectedArticleContent.value = '';
  summaryResult.value = '';
  qaHistory.value = [];
  followUpQuestion.value = '';
  lastSearchedKeyword.value = keyword.value;

  try {
    const apiKey = import.meta.env.VITE_GNEWS_API_KEY;
    if (!apiKey) throw new Error('VITE_GNEWS_API_KEY が設定されていません。');

    const response = await fetch('/api/fetch-news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gnewsApiKey: apiKey, keyword: keyword.value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'ニュースの取得に失敗しました。');
    articles.value = data;
  } catch (e: any) {
    error.news = e.message;
  } finally {
    loading.news = false;
  }
};

const selectArticle = async (article: any) => {
  if (selectedArticle.value?.url === article.url) return;
  selectedArticle.value = article;
  selectedArticleContent.value = '';
  summaryResult.value = '';
  qaHistory.value = [];
  followUpQuestion.value = '';
  error.content = '';
  error.summary = '';
  error.answer = '';
  
  fetchArticleContent(article.url);
};

const fetchArticleContent = async (url: string) => {
  loading.content = true;
  try {
    const response = await fetch('/api/fetch-article-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleUrl: url })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    selectedArticleContent.value = data.articleText;
    summarizeText(data.articleText);
  } catch (e: any) {
    error.content = e.message;
  } finally {
    loading.content = false;
  }
};

const summarizeText = async (text: string) => {
  loading.summary = true;
  try {
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!geminiApiKey) throw new Error('VITE_GEMINI_API_KEY が設定されていません。');
    
    const response = await fetch('/api/summarize-article', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleText: text, geminiApiKey })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    summaryResult.value = data.summary;
  } catch (e: any) {
    error.summary = e.message;
  } finally {
    loading.summary = false;
  }
};

const askQuestion = async () => {
  if (!followUpQuestion.value || !selectedArticleContent.value) return;

  loading.answer = true;
  error.answer = '';
  const currentQuestion = followUpQuestion.value;

  try {
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!geminiApiKey) throw new Error('VITE_GEMINI_API_KEY が設定されていません。');
    
    const response = await fetch('/api/answer-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        articleText: selectedArticleContent.value,
        question: currentQuestion,
        geminiApiKey 
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    qaHistory.value.unshift({ question: currentQuestion, answer: data.answer });
    followUpQuestion.value = '';

  } catch (e: any) {
    error.answer = e.message;
  } finally {
    loading.answer = false;
  }
};
</script>

<style>
  :root {
    --border-color: #e0e0e0;
    --background-color: #f0f2f5;
    --pane-background: #ffffff;
    --primary-color: #1a73e8;
    --text-color: #202124;
    --sub-text-color: #5f6368;
  }
  html, body {
    height: 100%;
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background-color: var(--background-color);
  }
  #app {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  .top-bar {
    display: flex;
    align-items: center;
    padding: 1rem 2rem;
    background-color: var(--pane-background);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }
  .top-bar h1 {
    font-size: 1.5rem;
    margin: 0;
    color: var(--primary-color);
  }
  .search-box {
    display: flex;
    gap: 1rem;
    margin-left: 2rem;
    width: 400px;
  }
  .search-box input {
    flex-grow: 1;
    padding: 0.5rem;
    font-size: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
  }
  .search-box button {
    padding: 0.5rem 1rem;
    font-size: 1rem;
    color: white;
    background-color: var(--primary-color);
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  .main-content {
    display: flex;
    flex-grow: 1;
    overflow: hidden;
  }
  .pane {
    flex: 1;
    overflow-y: auto;
    padding: 0;
    border-right: 1px solid var(--border-color);
  }
  .pane-title {
    font-size: 1.2rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    margin: 0;
    background-color: #f8f9fa;
    position: sticky;
    top: 0;
  }
  .pane:last-child {
    border-right: none;
  }
  .article-list-pane {
    flex: 0 0 350px;
  }
  .article-list-pane ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .article-list-pane li {
    padding: 1rem 1.5rem;
    cursor: pointer;
    border-bottom: 1px solid var(--border-color);
  }
  .article-list-pane li:hover {
    background-color: #f1f3f4;
  }
  .article-list-pane li.selected {
    background-color: #e8f0fe;
  }
  .article-list-pane h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: var(--text-color);
  }
  /* .source {
    font-size: 0.8rem;
    color: var(--sub-text-color);
    margin: 0;
  } */
  .source a {
  color: var(--sub-text-color);
  text-decoration: none;
}
.source a:hover {
  text-decoration: underline;
}
  .article-content-pane {
    flex: 2;
  }
  .article-body, .ai-section {
    padding: 1.5rem;
    line-height: 1.7;
    text-align: left;
  }
  .summary-result, .qa-history {
    line-height: 1.7;
    white-space: pre-wrap;
  }
  .placeholder {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    color: var(--sub-text-color);
    padding: 1.5rem;
  }
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 2rem auto;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .error-message {
    color: red;
    background-color: #ffebee;
    border: 1px solid red;
    padding: 1rem;
    border-radius: 4px;
    margin: 1rem;
  }
  .follow-up-section {
    border-top: 1px solid var(--border-color);
    padding-top: 1.5rem;
  }
  .question-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .question-form textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0.75rem;
    font-size: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    resize: vertical;
  }
  .question-form button {
    align-self: flex-end;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    color: white;
    background-color: var(--primary-color);
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  .qa-history {
    margin-top: 1.5rem;
  }
  .qa-item {
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px dashed var(--border-color);
  }
  .qa-item:last-child {
    border-bottom: none;
  }
  .qa-item .question {
    font-weight: bold;
    color: var(--text-color);
  }
   .qa-item .answer {
    color: var(--sub-text-color);
    padding-left: 1rem;
    border-left: 3px solid #1a73e8;
  }
</style>