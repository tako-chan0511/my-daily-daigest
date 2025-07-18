import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "POST method required." });
  }

  // ★★★ articleUrl の代わりに articleText と geminiApiKey を受け取る ★★★
  const { articleText, geminiApiKey } = req.body;

  if (!articleText || typeof articleText !== 'string') {
    return res.status(400).json({ error: '要約するための記事本文が必要です。' });
  }
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Gemini APIキーがフロントエンドから提供されませんでした。' });
  }

  try {
    // ★★★ HTMLの取得と本文抽出のロジックは不要になったので削除 ★★★

    // 抽出済みのテキストをGemini APIに渡して要約
    const prompt = `以下の記事を、Markdown形式で構造化して要約してください。見出し、太字、箇条書きリストなどを効果的に使用し、最も重要なポイントがひと目で分かるようにまとめてください。\n\n記事本文：\n${articleText}`;
    
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