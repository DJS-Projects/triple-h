import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const ticker = "1891.HK";
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
    
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error('Failed to fetch stock price');
    }

    const data = await response.json();
    
    // Extract the current price from the response
    const result = data?.chart?.result?.[0];
    const currentPrice = result?.meta?.regularMarketPrice;
    const previousClose = result?.meta?.previousClose;
    const currency = result?.meta?.currency;
    
    // Calculate change
    const change = currentPrice && previousClose ? currentPrice - previousClose : 0;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

    return NextResponse.json({
      ticker,
      price: currentPrice,
      change,
      changePercent,
      currency,
      previousClose,
    });
  } catch (error) {
    console.error('Error fetching stock price:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock price' },
      { status: 500 }
    );
  }
}
