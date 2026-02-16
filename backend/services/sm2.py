"""
SM-2 Spaced Repetition Algorithm
Implementation of the SuperMemo 2 algorithm for flashcard review scheduling
"""
from datetime import datetime, timedelta
from typing import Tuple


def calculate_next_review(quality: int, easiness_factor: float, repetitions: int,
                          interval: int) -> Tuple[float, int, int, datetime]:
    """
    Calculate next review parameters using SM-2 algorithm

    Args:
        quality: User rating (0-5)
            0: Complete blackout
            1: Incorrect but familiar
            2: Incorrect but easy to recall correct answer
            3: Correct with difficulty
            4: Correct with hesitation
            5: Perfect response
        easiness_factor: Current EF value (min 1.3)
        repetitions: Number of consecutive correct responses
        interval: Current interval in days

    Returns:
        (new_easiness_factor, new_repetitions, new_interval, next_review_date)
    """
    # Update easiness factor
    new_ef = easiness_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)  # Minimum EF is 1.3

    # Update repetitions and interval
    if quality < 3:
        # Incorrect response - restart
        new_repetitions = 0
        new_interval = 1
    else:
        # Correct response
        new_repetitions = repetitions + 1

        if new_repetitions == 1:
            new_interval = 1
        elif new_repetitions == 2:
            new_interval = 6
        else:
            new_interval = round(interval * new_ef)

    # Calculate next review date
    next_review_date = datetime.now() + timedelta(days=new_interval)

    return new_ef, new_repetitions, new_interval, next_review_date


def get_due_cards_count(cards: list, current_date: datetime = None) -> int:
    """
    Count cards due for review

    Args:
        cards: List of card dicts with 'next_review_date' field
        current_date: Current date (defaults to now)

    Returns:
        Number of cards due for review
    """
    if current_date is None:
        current_date = datetime.now()

    count = 0
    for card in cards:
        if card.get('next_review_date'):
            review_date = datetime.fromisoformat(card['next_review_date'])
            if review_date <= current_date:
                count += 1

    return count
