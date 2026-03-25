import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface JobPosition {
  title: string;
  description: string;
  requirements: string[];
  level: 'entry' | 'mid' | 'senior';
  industry: string;
}

export async function POST(req: NextRequest) {
  let requestData: any;
  
  try {
    requestData = await req.json();
    const { jobPosition, interviewType, numberOfQuestions } = requestData;
    
    console.log('Server: Generating questions with Gemini...');
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = createPrompt(jobPosition, interviewType, numberOfQuestions);
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    const questions = parseQuestionsFromResponse(text, interviewType);
    console.log('Server: Questions:', questions);
    
    if (questions.length > 0) {
      console.log('Server: Parsed', questions.length, 'questions from Gemini');
      return NextResponse.json({ 
        questions,
        success: true,
        source: 'gemini'
      });
    } else {
      throw new Error('No questions could be parsed from Gemini response');
    }
    
  } catch (error) {
    console.error('Server: Error:', error);
    
    const fallbackQuestions = getFallbackQuestions(
      requestData?.interviewType || 'general',
      requestData?.numberOfQuestions || 3
    );
    
    console.log('Server: Using', fallbackQuestions.length, 'fallback questions');
    
    return NextResponse.json({ 
      questions: fallbackQuestions,
      success: false,
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function createPrompt(
  jobPosition: JobPosition,
  interviewType: 'general' | 'technical' | 'behavioral',
  numberOfQuestions: number
): string {
  const baseContext = `
Job Title: ${jobPosition.title}
Job Description: ${jobPosition.description}
Requirements: ${jobPosition.requirements.join(', ')}
Experience Level: ${jobPosition.level}
Industry: ${jobPosition.industry}
`;

  const typeSpecificPrompts = {
    general: `
Generate ${numberOfQuestions} general interview questions for this position.
Focus on:
- Basic qualifications and background
- Motivation and career goals
- Company fit and cultural alignment
- Communication skills
- Professional interests

Make questions conversational and suitable for a ${jobPosition.level} level position.
`,
    technical: `
Generate ${numberOfQuestions} technical interview questions for this position.
Focus on:
- Specific technical skills mentioned in requirements
- Problem-solving scenarios relevant to the role
- Technology stack and tools
- Code quality and best practices
- System design (if senior level)
- Practical application of skills

Adjust difficulty based on ${jobPosition.level} level.
`,
    behavioral: `
Generate ${numberOfQuestions} behavioral interview questions for this position.
Focus on:
- Past experiences relevant to the role
- Teamwork and collaboration
- Leadership and initiative (especially for ${jobPosition.level} level)
- Conflict resolution
- Adaptability and learning
- Project management
- Communication under pressure

Use STAR method framework and make questions specific to ${jobPosition.level} level expectations.
`
  };

  return `
${baseContext}

${typeSpecificPrompts[interviewType]}

Format your response as a JSON array with the following structure:
[
  {
    "question": "Your interview question here",
    "difficulty": "easy|medium|hard",
    "expectedDuration": 2
  }
]

Requirements:
- Return exactly ${numberOfQuestions} questions
- Make questions specific to the job requirements
- Vary difficulty appropriately for ${jobPosition.level} level
- Each question should take 1-3 minutes to answer
- Questions should be human-like, natural and conversational
- Avoid generic questions that could apply to any job
`;
}

function parseQuestionsFromResponse(
  response: string,
  interviewType: 'general' | 'technical' | 'behavioral'
) {
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((item: any, index: number) => ({
        id: `${interviewType}-${Date.now()}-${index}`,
        question: item.question || item.text || item,
        type: interviewType,
        difficulty: item.difficulty || 'medium',
        expectedDuration: item.expectedDuration || 2
      }));
    }

    const lines = response
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => line.replace(/^\d+\.?\s*/, '').trim())
      .filter(line => line.length > 20);

    return lines.map((question, index) => ({
      id: `${interviewType}-${Date.now()}-${index}`,
      question,
      type: interviewType,
      difficulty: 'medium' as const,
      expectedDuration: 2
    }));

  } catch (error) {
    console.error('Error parsing questions response:', error);
    return [];
  }
}

function getFallbackQuestions(
  interviewType: 'general' | 'technical' | 'behavioral',
  numberOfQuestions: number
) {
  const fallbacks = {
    general: [
      "Tell me about yourself and your professional background.",
      "Why are you interested in this specific position?",
      "What attracted you to our company?",
      "What are your greatest professional strengths?",
      "Where do you see your career heading in the next few years?"
    ],
    technical: [
      "Walk me through your experience with the main technologies required for this role.",
      "How do you approach debugging a complex technical problem?",
      "Describe the most challenging technical project you've worked on.",
      "How do you ensure code quality in your projects?",
      "Explain your development workflow from concept to deployment."
    ],
    behavioral: [
      "Tell me about a time you faced a significant challenge at work and how you overcame it.",
      "Describe a situation where you had to work with a difficult team member.",
      "Give me an example of when you had to learn something completely new under pressure.",
      "Tell me about a time you made a mistake and how you handled it.",
      "Describe a situation where you had to meet a very tight deadline."
    ]
  };

  const questions = fallbacks[interviewType] || fallbacks.general;
  
  return questions
    .slice(0, numberOfQuestions)
    .map((question, index) => ({
      id: `fallback-${interviewType}-${index}`,
      question,
      type: interviewType,
      difficulty: 'medium' as const,
      expectedDuration: 2
    }));
}
