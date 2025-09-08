import os
import json
from datetime import date
from typing import Any, Dict, List, Tuple

from google.genai import Client
from google.genai import types

from voice_flow_shared.prompt import generate_instruction


client = Client(api_key=os.getenv("GOOGLE_API_KEY"))


def _parse_json(text: str):
    return json.loads(text.lstrip("```json\n").rstrip("\n```").strip())


def generate_persona(prompt: str) -> Dict[str, Any]:
    instructions = """
    You are an expert persona generator for debt collection testing scenarios. Create realistic, 
    nuanced defaulter personas that provide meaningful training data for debt collection agents.

    PERSONA REQUIREMENTS:
    - Generate believable individuals with authentic financial circumstances
    - Consider psychological factors that lead to payment defaults
    - Include realistic financial constraints and life situations
    - Vary communication styles, emotional responses, and negotiation approaches
    - Ensure personas have clear motivations and barriers to payment
    - Create diverse scenarios that challenge different collection strategies

    RESPONSE FORMAT:
    Respond ONLY with a valid JSON object containing exactly these fields:
    - full_name: realistic name appropriate for demographics
    - age: integer between 18-75
    - gender: 'male', 'female', or 'non-binary'
    - debt_amount: float (original amount owed)
    - due_date: date in YYYY-MM-DD format (should be in the past or near future)
    - description: comprehensive 200-500 word persona description including:
      - Personal background and current life situation
      - Employment status and income sources
      - Reason(s) for default (job loss, medical bills, family crisis, divorce, business failure, etc.)
      - Current financial constraints and competing priorities
      - Personality traits affecting negotiation (cooperative, defensive, anxious, proud, etc.)
      - Communication style and likely responses to debt collectors
      - Potential solutions they might be open to (payment plans, partial settlement, etc.)
      - Emotional triggers and stress points
      - Past experiences with debt or financial institutions
      - Family situation and dependencies
      - Educational background and financial literacy level

    PERSONA VARIETY GUIDELINES:
    - Mix demographics: various ages, backgrounds, income levels, locations
    - Include different default reasons: medical emergencies, unemployment, divorce, business failure, 
      family crisis, identity theft, dispute over services, etc.
    - Vary personality types: cooperative vs. hostile, organized vs. chaotic, prideful vs. humble,
      anxious vs. confident, experienced vs. naive with debt situations
    - Different financial literacy levels and negotiation sophistication
    - Range of current circumstances: temporary hardship vs. chronic financial issues
    - Various relationship to the debt: legitimate debt, disputed charges, co-signed obligations, etc.
    - Different availability and preferences for communication (phone, email, text, in-person)

    Create personas that will challenge debt collection agents to practice different approaches,
    from empathetic negotiation to firm boundary-setting, while maintaining ethical collection practices.
    Each persona should feel like a real person with genuine circumstances, not a stereotype.
    """
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            types.Content(
                **{
                    "role": "user",
                    "parts": [
                        {
                            "text": f"Generate a defaulter persona based on this description: {prompt}"
                        }
                    ],
                }
            )
        ],
        config=types.GenerateContentConfig(system_instruction=instructions),
    )

    data = _parse_json(response.text)
    if isinstance(data.get("due_date"), str):
        data["due_date"] = date.fromisoformat(data["due_date"])

    if "debt_amount" in data:
        data["debt_amount"] = int(data["debt_amount"])

    required = {"full_name", "age", "gender", "debt_amount", "due_date", "description"}
    missing = sorted(required - set(data))

    if missing:
        raise RuntimeError(f"Persona JSON missing fields: {', '.join(missing)}")

    return data


def agent_reply(persona: Dict[str, Any], history: List[Dict[str, str]]) -> str:
    instructions = generate_instruction(persona)

    # Convert history format from {"persona": "...", "agent": "..."} to Google GenAI format
    # For agent_reply: persona becomes "user" and agent becomes "model"
    contents = []
    for entry in history:
        if "persona" in entry:
            contents.append(
                types.Content(**{"role": "user", "parts": [{"text": entry["persona"]}]})
            )
        if "agent" in entry:
            contents.append(
                types.Content(**{"role": "model", "parts": [{"text": entry["agent"]}]})
            )

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=contents,
        config=types.GenerateContentConfig(system_instruction=instructions),
    )

    return response.text


def persona_reply(persona: Dict[str, Any], history: List[Dict[str, str]]) -> str:
    instructions = f"""
    You are roleplaying as a defaulter (debtor) in a debt collection scenario for training purposes.
    
    PERSONA DETAILS:
    - Name: {persona.get("full_name", "Unknown")}
    - Age: {persona.get("age", "Unknown")}
    - Gender: {persona.get("gender", "Unknown")}
    - Outstanding Debt: ${persona.get("debt_amount", "Unknown")}
    - Due Date: {persona.get("due_date", "Unknown")}
    
    PERSONA BACKGROUND:
    {persona.get("description", "No additional background provided.")}
    
    ROLEPLAY INSTRUCTIONS:
    - Stay completely in character as this defaulter throughout the conversation
    - Respond naturally based on this persona's background, personality, and financial situation
    - Show realistic emotions and reactions that match this character's circumstances
    - Use communication style that fits this persona's education level and personality
    - Be authentic to the character's motivations, fears, and constraints
    - If the agent asks about payment, respond based on this persona's actual financial situation
    - Show appropriate levels of cooperation, defensiveness, anxiety, or other traits described in the persona
    - Reference specific details from your background when relevant (job situation, family, health issues, etc.)
    - Don't break character or acknowledge this is a roleplay scenario
    - Respond only as this character would respond, using their voice and perspective
    - Keep responses conversational and realistic for a phone call scenario
    - Generate output only in plain english. DON'T use markdown format
    """

    # Convert history format from {"persona": "...", "agent": "..."} to Google GenAI format
    # For persona_reply: agent becomes "user" and persona becomes "model"
    contents = []
    for entry in history:
        if "agent" in entry:
            contents.append(
                types.Content(**{"role": "user", "parts": [{"text": entry["agent"]}]})
            )
        if "persona" in entry:
            contents.append(
                types.Content(
                    **{"role": "model", "parts": [{"text": entry["persona"]}]}
                )
            )

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=contents,
        config=types.GenerateContentConfig(system_instruction=instructions),
    )

    return response.text


def validate_conversation(history: List[Dict[str, str]]) -> Tuple[Dict[str, str], str, str]:
    instruction = """
    You are an expert evaluator of debt collection conversations for training purposes. 
    Analyze the conversation between a debt collection agent and a defaulter to provide metrics and pass/fail status.
    
    EVALUATION CRITERIA FOR PASSING:
    The agent MUST meet BOTH criteria to pass:
    1. POLITENESS: Must be exactly "polite" (not too_polite, impolite, or too_impolite)
       - Respectful but firm language and tone
       - Professional demeanor without being overly accommodating
       - Avoiding aggressive, threatening, or inappropriate language
       - Balanced approach: empathetic but not excessively so
    
    2. NEGOTIATION_LEVEL: Must be exactly "hard" (not low or medium)
       - Strong, persistent negotiation approach
       - Pressing for payment commitments and solutions
       - Not easily accepting excuses or delays
       - Demonstrating urgency while remaining professional
       - Actively working towards concrete payment arrangements
    
    RESPONSE FORMAT:
    Respond ONLY with a valid JSON object containing exactly these fields:
    - metric: object with "politeness" and "negotiation_level" fields (strings: too_polite|polite|impolite|too_impolite for politeness, low|medium|hard for negotiation_level)
    - status: "passed" if both politeness="polite" AND negotiation_level="hard", otherwise "failed"
    - feedback: comprehensive string feedback (200-400 words) that MUST include:
      - Clear statement of pass/fail status and why
      - If failed, specific areas that need improvement:
        * If politeness was not "polite": explain exactly what was wrong (too soft/aggressive) and how to achieve the right balance
        * If negotiation_level was not "hard": explain what stronger negotiation tactics should have been used
      - If passed: highlight what the agent did well in both politeness and negotiation
      - Specific examples from the conversation
      - Concrete suggestions for improvement (if failed) or maintaining performance (if passed)
    
    Remember: The agent must be polite but firm, empathetic but persistent. Too polite = fail, impolite = fail, weak negotiation = fail.
    """

    # Format the conversation history for the validator
    conversation_text = "\n".join(
        [
            f"Agent: {entry.get('agent', '')}"
            if "agent" in entry
            else f"Defaulter: {entry.get('persona', '')}"
            for entry in history
            if entry
        ]
    )

    contents = [
        types.Content(
            **{
                "role": "user",
                "parts": [
                    {
                        "text": f"Evaluate this debt collection conversation:\n\n{conversation_text}"
                    }
                ],
            }
        )
    ]

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=types.GenerateContentConfig(system_instruction=instruction),
    )

    data = _parse_json(response.text)
    metric = data.get("metric")
    status = data.get("status")
    feedback = data.get("feedback")

    if not isinstance(metric, dict) or not isinstance(status, str) or not isinstance(feedback, str):
        raise RuntimeError("Validator output missing required keys")

    if "politeness" not in metric or "negotiation_level" not in metric:
        raise RuntimeError(
            "Validator metric must include politeness and negotiation_level"
        )

    # Validate status based on metric values
    expected_status = "passed" if (metric.get("politeness") == "polite" and metric.get("negotiation_level") == "hard") else "failed"
    if status != expected_status:
        # Override status if LLM got it wrong
        status = expected_status

    return metric, feedback, status


def improve_prompt(current_prompt: str, metric: Dict[str, str], feedback: str) -> str:
    """Improve a prompt based on test run metrics and feedback.
    
    Args:
        current_prompt: The current prompt text to improve.
        metric: Dictionary containing metrics like politeness and negotiation_level.
        feedback: Detailed feedback about what needs improvement.
        
    Returns:
        Improved prompt text.
        
    Raises:
        RuntimeError: If prompt improvement fails.
    """
    instructions = """
    You are an expert prompt engineer specializing in debt collection training scenarios.
    Your task is to improve an existing debt collection agent prompt based on performance metrics and detailed feedback.
    
    IMPROVEMENT CRITERIA:
    The goal is to create a prompt that helps agents achieve:
    - POLITENESS: Exactly "polite" (respectful but firm, professional without being overly accommodating)
    - NEGOTIATION_LEVEL: Exactly "hard" (strong, persistent approach that presses for payment commitments)
    
    PROMPT IMPROVEMENT GUIDELINES:
    1. Analyze the current prompt and identify areas that need strengthening
    2. If politeness was "too_polite": Add more assertive language, reduce overly accommodating phrases
    3. If politeness was "impolite" or "too_impolite": Add more respectful, empathetic language
    4. If negotiation_level was "low" or "medium": Add stronger negotiation tactics, more persistent approaches
    5. Maintain the core structure but enhance specific sections that relate to the feedback
    6. Ensure the improved prompt maintains professionalism while being more effective
    7. Keep all existing formatting placeholders ({full_name}, {debt_amount}, {due_date})
    8. Preserve the essential debt collection best practices and legal compliance aspects
    
    RESPONSE FORMAT:
    Respond with ONLY the improved prompt text. Do not include any explanations, comments, or markdown formatting.
    The output should be the complete, ready-to-use prompt that can directly replace the current one.
    """
    
    prompt_content = f"""
    CURRENT PROMPT:
    {current_prompt}
    
    PERFORMANCE METRICS:
    - Politeness: {metric.get('politeness', 'unknown')}
    - Negotiation Level: {metric.get('negotiation_level', 'unknown')}
    
    DETAILED FEEDBACK:
    {feedback}
    
    Please improve this prompt to address the identified issues and achieve the target metrics.
    """
    
    contents = [
        types.Content(
            **{
                "role": "user",
                "parts": [{"text": prompt_content}],
            }
        )
    ]
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=contents,
            config=types.GenerateContentConfig(system_instruction=instructions),
        )
        
        improved_prompt = response.text.strip()
        
        # Basic validation to ensure the improved prompt contains required placeholders
        required_placeholders = ['{full_name}', '{debt_amount}', '{due_date}']
        missing_placeholders = [p for p in required_placeholders if p not in improved_prompt]
        
        if missing_placeholders:
            raise RuntimeError(f"Improved prompt is missing required placeholders: {missing_placeholders}")
        
        return improved_prompt
        
    except Exception as e:
        raise RuntimeError(f"Failed to improve prompt: {str(e)}")
