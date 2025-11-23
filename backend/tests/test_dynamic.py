import unittest
import sys
import os
import pandas as pd
from unittest.mock import MagicMock, patch

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.services import run_dynamic_scenario
from src.llm_service import LLMService

class TestDynamicBacktest(unittest.TestCase):
    def setUp(self):
        # Mock the LLM service to avoid actual API calls during basic testing
        self.original_generate = LLMService.generate_backtest_condition
        
    def tearDown(self):
        LLMService.generate_backtest_condition = self.original_generate

    def test_dynamic_scenario_execution(self):
        # Mock the LLM response with a valid python function
        mock_code = """
def condition(data):
    # Simple condition: Return > 0
    return data['Return'] > 0
"""
        LLMService.generate_backtest_condition = MagicMock(return_value=mock_code)
        
        # Run the scenario
        result = run_dynamic_scenario("When market is up")
        
        # Verify structure
        self.assertIn('results', result)
        self.assertIn('control', result)
        self.assertIn('generated_code', result)
        
        # Verify results content
        self.assertIn('count', result['results'])
        self.assertGreater(result['results']['count'], 0)
        
        # Verify control content
        self.assertIn('1Y', result['control'])
        self.assertIsNotNone(result['control']['1Y'])

    def test_invalid_code_handling(self):
        # Mock with invalid code
        mock_code = "def condition(data): return syntax error"
        LLMService.generate_backtest_condition = MagicMock(return_value=mock_code)
        
        result = run_dynamic_scenario("Invalid query")
        self.assertIn('error', result)

if __name__ == '__main__':
    unittest.main()
