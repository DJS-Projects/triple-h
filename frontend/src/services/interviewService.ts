import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

export interface InterviewQuestion {
  id: string;
  question: string;
  type: 'general' | 'technical' | 'behavioral';
  difficulty: 'easy' | 'medium' | 'hard';
  expectedDuration: number; // in minutes
}

export interface JobPosition {
  title: string;
  description: string;
  requirements: string[];
  level: 'entry' | 'mid' | 'senior';
  industry: string;
}

export async function generateInterviewQuestions(
  jobPosition: JobPosition,
  interviewType: 'general' | 'technical' | 'behavioral',
  numberOfQuestions: number = 5
): Promise<InterviewQuestion[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = createPrompt(jobPosition, interviewType, numberOfQuestions);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Parse the response into structured questions
    const questions = parseQuestionsFromResponse(text, interviewType);
    
    return questions.length > 0 ? questions : getFallbackQuestions(interviewType, numberOfQuestions);
    
  } catch (error) {
    console.error('Error generating questions with Gemini:', error);
    return getFallbackQuestions(interviewType, numberOfQuestions);
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
- Questions should be natural and conversational
- Avoid generic questions that could apply to any job
`;
}

function parseQuestionsFromResponse(
  response: string,
  interviewType: 'general' | 'technical' | 'behavioral'
): InterviewQuestion[] {
  try {
    // Try to parse JSON response first
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

    // Fallback: parse line by line
    const lines = response
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => line.replace(/^\d+\.?\s*/, '').trim())
      .filter(line => line.length > 20); // Filter out short responses

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
): InterviewQuestion[] {
  const fallbacks = {
    general: [
      "Tell me about yourself and your professional background.",
      "Why are you interested in this specific position?",
      "What attracted you to our company?",
      "What are your greatest professional strengths?",
      "Where do you see your career heading in the next few years?",
      "What motivates you in your work?",
      "How do you handle stress and pressure?",
      "What's your ideal work environment?"
    ],
    technical: [
      "Walk me through your experience with the main technologies required for this role.",
      "How do you approach debugging a complex technical problem?",
      "Describe the most challenging technical project you've worked on.",
      "How do you ensure code quality in your projects?",
      "Explain your development workflow from concept to deployment.",
      "How do you stay updated with new technologies and industry trends?",
      "Describe a time when you had to learn a new technology quickly.",
      "How do you handle technical debt in your projects?"
    ],
    behavioral: [
      "Tell me about a time you faced a significant challenge at work and how you overcame it.",
      "Describe a situation where you had to work with a difficult team member.",
      "Give me an example of when you had to learn something completely new under pressure.",
      "Tell me about a time you made a mistake and how you handled it.",
      "Describe a situation where you had to meet a very tight deadline.",
      "Tell me about a time you had to persuade someone to see things your way.",
      "Describe a project where you took the lead.",
      "Tell me about a time you received constructive criticism and how you responded."
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

// Text-to-Speech service
export async function generateSpeechFromText(text: string): Promise<string> {
  try {
    // For now, we'll use browser's built-in speech synthesis
    // In production, you'd integrate with a more advanced TTS service
    if ('speechSynthesis' in window) {
      return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 0.8;
        
        // Find a suitable voice
        const voices = speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => 
          voice.lang.startsWith('en') && voice.name.includes('Female')
        ) || voices.find(voice => voice.lang.startsWith('en'));
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        
        utterance.onend = () => resolve('speech-completed');
        utterance.onerror = (error) => reject(error);
        
        speechSynthesis.speak(utterance);
      });
    }
    
    throw new Error('Speech synthesis not supported');
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
  }
}

// AI Feedback Generation
export async function generateAIFeedback(
  jobPosition: JobPosition,
  interviewType: 'general' | 'technical' | 'behavioral',
  answers: Array<{
    question: string;
    answer: string;
    timestamp: Date;
  }>
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const feedbackPrompt = createFeedbackPrompt(jobPosition, interviewType, answers);
    const result = await model.generateContent(feedbackPrompt);
    const feedback = result.response.text();
    
    return feedback || getFallbackFeedback(interviewType, answers.length);
    
  } catch (error) {
    console.error('Error generating AI feedback:', error);
    return getFallbackFeedback(interviewType, answers.length);
  }
}

function createFeedbackPrompt(
  jobPosition: JobPosition,
  interviewType: 'general' | 'technical' | 'behavioral',
  answers: Array<{
    question: string;
    answer: string;
    timestamp: Date;
  }>
): string {
  const contextInfo = `
Position: ${jobPosition.title}
Industry: ${jobPosition.industry}
Experience Level: ${jobPosition.level}
Interview Type: ${interviewType}
Key Requirements: ${jobPosition.requirements.join(', ')}
`;

  const qaSection = answers.map((qa, index) => `
Question ${index + 1}: ${qa.question}
Answer: ${qa.answer || '[No answer provided]'}
`).join('\n');

  return `
You are an expert interview coach and hiring manager. Please provide detailed, constructive feedback for this ${interviewType} interview.

${contextInfo}

Interview Q&A:
${qaSection}

Please provide feedback covering:

1. **Overall Performance** (2-3 sentences)
   - General impression and interview readiness
   - Communication clarity and confidence level

2. **Strengths** (3-4 bullet points)
   - What the candidate did well
   - Strong answers or examples provided
   - Positive qualities demonstrated

3. **Areas for Improvement** (3-4 bullet points)
   - Specific areas to focus on
   - Missing elements in answers
   - Skills or knowledge gaps to address

4. **Specific Recommendations** (3-4 actionable items)
   - How to improve weak areas
   - Resources or practice suggestions
   - Interview strategy tips

5. **Position-Specific Feedback**
   - How well answers align with ${jobPosition.title} requirements
   - Industry-specific insights
   - Level-appropriate expectations

Keep feedback:
- Constructive and encouraging
- Specific with examples from their answers
- Actionable with clear next steps
- Professional but supportive in tone
- Tailored to ${jobPosition.level} level expectations

Format as clear sections with headers and bullet points for easy reading.
`;
}

function getFallbackFeedback(
  interviewType: 'general' | 'technical' | 'behavioral',
  answersCount: number
): string {
  return `
## Overall Performance

Great job completing your ${interviewType} interview! You answered ${answersCount} questions and showed engagement throughout the process.

## Strengths
• **Participation**: You actively engaged with all questions presented
• **Completion**: You followed through with the entire interview process
• **Practice Mindset**: You're taking initiative to improve your interview skills
• **Technology Comfort**: You successfully used the AI interview platform

## Areas for Improvement
• **Answer Depth**: Consider providing more detailed examples in your responses
• **Structure**: Use frameworks like STAR (Situation, Task, Action, Result) for behavioral questions
• **Preparation**: Research common ${interviewType} questions for more practice
• **Confidence**: Continue practicing to build confidence in your delivery

## Specific Recommendations
• **Practice More**: Use this platform regularly to build confidence
• **Record Yourself**: Practice answering questions while recording to review your performance
• **Research**: Study the specific requirements for your target positions
• **Mock Interviews**: Consider practicing with friends or career counselors

## Next Steps
Keep practicing with different types of questions and positions. Each interview session will help you improve your communication skills and confidence level.

Remember: Every interview is a learning opportunity. You're on the right track by practicing regularly!
`;
}

// Real Wav2Lips integration via backend API
export async function generateLipSyncVideo(
  text: string,
  imageUrl: string
): Promise<string> {
  try {
    console.log('🎬 Generating lip-sync video with Wav2Lips backend...');
    console.log('Text length:', text.length, 'characters');
    console.log('Avatar image:', imageUrl);
    
    // Make full URL for avatar image
    const fullAvatarUrl = imageUrl.startsWith('http') 
      ? imageUrl 
      : `${window.location.origin}${imageUrl}`;
    
    const response = await fetch('/api/wav2lip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        avatarUrl: fullAvatarUrl,
        language: 'en'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate lip-sync video');
    }

    const result = await response.json();
    
    if (!result.video_url) {
      throw new Error('No video URL returned from lip-sync service');
    }

    console.log('✅ Lip-sync video generated successfully');
    return result.video_url;
    
  } catch (error) {
    console.error('❌ Error generating lip-sync video:', error);
    throw error;
  }
}

// Text-to-Speech with audio blob generation
export async function generateSpeechAudio(text: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    // Find the best available voice
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.lang.startsWith('en') && 
      (voice.name.includes('Female') || voice.name.includes('Neural'))
    ) || voices.find(voice => voice.lang.startsWith('en'));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    // Note: Browser speech synthesis doesn't provide audio blobs directly
    // In a real implementation, you'd use a TTS service that returns audio files
    utterance.onend = () => {
      // Create a placeholder blob
      const audioBlob = new Blob([''], { type: 'audio/wav' });
      resolve(audioBlob);
    };

    utterance.onerror = (error) => reject(error);
    
    speechSynthesis.speak(utterance);
  });
}

export const jobPositions = [
  {
    title: "Frontend Developer",
    description: "Develop user-facing web applications using modern JavaScript frameworks",
    requirements: ["React", "TypeScript", "CSS", "HTML", "Git"],
    level: "mid" as const,
    industry: "Technology"
  },
  {
    title: "Full Stack Developer", 
    description: "Build end-to-end web applications with both frontend and backend components",
    requirements: ["React", "Node.js", "MongoDB", "Express", "REST APIs"],
    level: "mid" as const,
    industry: "Technology"
  },
  {
    title: "Data Scientist",
    description: "Analyze large datasets to extract insights and build predictive models",
    requirements: ["Python", "Machine Learning", "SQL", "Statistics", "Data Visualization"],
    level: "senior" as const,
    industry: "Technology"
  },
  {
    title: "UX Designer",
    description: "Design user experiences for digital products and services",
    requirements: ["Figma", "User Research", "Prototyping", "Design Systems", "Usability Testing"],
    level: "mid" as const,
    industry: "Design"
  },
  {
    title: "Product Manager",
    description: "Lead product development from conception to launch",
    requirements: ["Product Strategy", "Agile", "Analytics", "Stakeholder Management", "Market Research"],
    level: "senior" as const,
    industry: "Technology"
  },
  {
    title: "Software Engineer",
    description: "Design and develop scalable software solutions",
    requirements: ["Java", "Spring Boot", "Microservices", "Docker", "Kubernetes"],
    level: "mid" as const,
    industry: "Technology"
  }
];
