import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "POST method required." });
  }

  const { keyword, gnewsApiKey } = req.body;

  if (!keyword || typeof keyword !== 'string') {
    return res.status(400).json({ error: '検索キーワードが必要です。' });
  }
  if (!gnewsApiKey) {
    return res.status(500).json({ error: 'GNews APIキーがフロントエンドから提供されませんでした。' });
  }

  try {
    const params = new URLSearchParams({
      q: keyword,
      lang: 'ja',
      country: 'jp',
      max: '10',
      apikey: gnewsApiKey,
    });

    const gnewsUrl = `https://gnews.io/api/v4/search?${params.toString()}`;
    console.log(`[Info] Searching GNews: ${gnewsUrl}`);
    
    const response = await fetch(gnewsUrl);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`GNews API request failed: ${response.status} ${errorData?.errors?.join(', ') || 'Unknown error'}`);
    }

    const data = await response.json();
    res.status(200).json(data.articles || []);

  } catch (error: any) {
    console.error('An error occurred in fetch-news handler:', error);
    res.status(500).json({ error: error.message || 'サーバーでエラーが発生しました。' });
  }
}