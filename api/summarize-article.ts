import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as cheerio from 'cheerio';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "POST method required." });
  }

  const { articleUrl } = req.body;
  const geminiApiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!articleUrl || typeof articleUrl !== 'string') {
    return res.status(400).json({ error: '記事のURLが必要です。' });
  }
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Gemini APIキーが設定されていません。' });
  }

  try {
    // 1. 記事のURLからHTMLを取得
    console.log(`[Info] Fetching article HTML from: ${articleUrl}`);
    const articleResponse = await fetch(articleUrl);
    if (!articleResponse.ok) {
      throw new Error(`記事ページの取得に失敗しました: ${articleResponse.status}`);
    }
    const html = await articleResponse.text();

    // 2. cheerioでHTMLを解析し、本文テキストを抽出
    const $ = cheerio.load(html);
    const articleText = $('p').text().trim().replace(/\s\s+/g, ' '); // 簡単な例として<p>タグのテキストを全て結合
    console.log(`[Info] Extracted text length: ${articleText.length}`);
    
    if (articleText.length < 100) { // テキストが短すぎる場合はエラー
        throw new Error('記事から十分なテキストを抽出できませんでした。');
    }

    // 3. 抽出したテキストをGemini APIに渡して要約
    const prompt = `以下のニュース記事の本文を、最も重要な3つのポイントにまとめて、箇条書きで簡潔に要約してください。\n\n---記事本文---\n${articleText.substring(0, 8000)}\n\n---要約---`;
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!apiResponse.ok) throw new Error(`AI APIがエラー: ${apiResponse.status}`);
    
    const responseData = await apiResponse.json();
    const summary = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!summary) throw new Error('AIからの応答が空です。');

    res.status(200).json({ summary: summary.trim() });

  } catch (error: any) {
    console.error('An error occurred in summarize-article handler:', error);
    res.status(500).json({ error: error.message || 'サーバーでエラーが発生しました。' });
  }
}