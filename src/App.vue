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
    /* カラーパレットを微調整して、より柔らかい印象に */
    --border-color: #e0e0e0;
    --background-color: #f4f5f7; /* 少しだけ色味のある背景色 */
    --pane-background: #ffffff;
    --primary-color: #0d6efd; /* より鮮やかな青 */
    --text-color: #212529;
    --sub-text-color: #6c757d;
    --selected-bg-color: #e9ecef; /* 選択時の背景色 */
  }
  html, body {
    height: 100%;
    margin: 0;
    font-family: 'Hiragino Kaku Gothic ProN', 'ヒラギノ角ゴ ProN W3', Meiryo, メイリオ, Osaka, 'MS PGothic', arial, helvetica, sans-serif;
    background-color: var(--background-color);
    color: var(--text-color);
  }
  #app {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  /* --- 1. トップバーの改善 --- */
  .top-bar {
    display: flex;
    align-items: center;
    padding: 1rem 1.5rem;
    background-color: var(--pane-background);
    /* 影を付けてコンテンツエリアから少し浮き上がらせる */
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    z-index: 10; /* 他の要素より手前に表示 */
    flex-shrink: 0;
  }
  .top-bar h1 {
    font-size: 1.5rem;
    margin: 0;
    color: #333; /* ブランドカラーではなく、落ち着いた色に */
  }
  .search-box {
    display: flex;
    gap: 0.5rem; /* ボタンとの間隔を少し詰める */
    margin-left: auto; /* 右寄せにする */
    width: 450px;
  }
  .search-box input {
    flex-grow: 1;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 8px; /* 角を丸く */
    transition: all 0.2s ease; /* フォーカス時のアニメーション */
  }
  .search-box input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.25);
  }

   .search-box button {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    color: white;
    background-color: var(--primary-color);
    border: none;
    border-radius: 8px; /* 角を丸く */
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  .search-box button:hover:not(:disabled) {
    background-color: #0b5ed7; /* ホバー時少し濃くする */
  }
  .search-box button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  /* --- 2. メインコンテンツエリアの改善 --- */
  .main-content {
    display: flex;
    flex-grow: 1;
    overflow: hidden;
    padding: 1rem; /* パネルの外側に余白を追加 */
    gap: 1rem; /* パネル間の隙間を設定 */
  }
  .pane {
    flex: 1;
    overflow-y: auto;
    background-color: var(--pane-background);
    border: none; /* ボーダーを削除 */
    border-radius: 12px; /* パネルの角を丸くする */
    box-shadow: 0 4px 12px rgba(0,0,0,0.08); /* 影を付けてカード感を出す */
    display: flex;
    flex-direction: column;
  }

  .pane-title {
    font-size: 1.1rem;
    font-weight: 600;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    margin: 0;
    background-color: #fcfcfc;
    position: sticky;
    top: 0;
    z-index: 5;
    /* 角丸を親要素に合わせる */
    border-top-left-radius: 12px;
    border-top-right-radius: 12px;
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
  .source {
    font-size: 0.8rem;
    color: var(--sub-text-color);
    margin: 0;
  }
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
  .article-body {
    padding: 1.5rem;
    line-height: 1.8; /* 行間を広げて読みやすくする */
  }

/* --- 4. AIアシスタントパネルの改善 --- */
  .ai-assistant-pane {
    flex: 1.2; /* 少し広く取る */
  }
  .ai-section {
    padding: 1.5rem;
  }
  .ai-section h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 1rem;
    font-weight: 600;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.75rem;
  }


   .summary-result {
    line-height: 1.7;
    background-color: #f8f9fa;
    padding: 1rem;
    border-radius: 8px;
    white-space: pre-wrap;
  }
   .question-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .question-form textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0.75rem;
    font-size: 0.95rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    resize: vertical;
    transition: all 0.2s ease;
  }
  .question-form textarea:focus {
     outline: none;
     border-color: var(--primary-color);
     box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.25);
  }
  .question-form button {
    align-self: flex-end;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    color: white;
    background-color: var(--primary-color);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  .question-form button:hover:not(:disabled) {
    background-color: #0b5ed7;
  }
/* チャット風の対話履歴 */
  .qa-history {
    margin-top: 1.5rem;
    padding: 0 0.5rem;
  }
  .qa-item {
    margin-bottom: 1.5rem;
    border-bottom: none; /* 区切り線を削除 */
    display: flex;
    flex-direction: column;
  }
  .qa-item .question, .qa-item .answer {
    padding: 0.75rem 1rem;
    border-radius: 12px;
    line-height: 1.6;
    max-width: 90%;
  }
  .qa-item .question {
    background-color: var(--selected-bg-color);
    align-self: flex-end; /* 質問を右寄せ */
    border-bottom-right-radius: 0; /* 吹き出し風 */
  }
  .qa-item .answer {
    background-color: #f1f3f4;
    align-self: flex-start; /* 回答を左寄せ */
    border-bottom-left-radius: 0; /* 吹き出し風 */
    white-space: pre-wrap;
    margin-top: 0.5rem;
  }
  .qa-item p {
    margin: 0;
  }



 /* --- 5. 共通・ユーティリティ要素 --- */
  .placeholder {
    flex-grow: 1; /* パネル内で中央に配置するため */
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--sub-text-color);
    padding: 1.5rem;
    text-align: center;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: auto; /* 中央配置 */
    position: absolute; /* 他の要素の上に表示 */
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-message {
    color: #b91c1c;
    background-color: #fef2f2;
    border: 1px solid #fca5a5;
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem;
  }

</style>