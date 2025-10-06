"""
Chain Progress Manager

Manages chain execution state and broadcasts progress to connected WebSocket clients.
Provides real-time updates about chain execution progress.
"""

import asyncio
from typing import Dict, List, Set, Optional, Any
from datetime import datetime
import json


class ChainProgressManager:
    """Singleton manager for chain execution progress"""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._initialized = True
        self.clients: Set = set()  # WebSocket connections
        self.current_execution: Optional[Dict[str, Any]] = None
        self.lock = asyncio.Lock()

    async def add_client(self, websocket):
        """Add a WebSocket client and send current state"""
        async with self.lock:
            self.clients.add(websocket)

            # Send initial state
            if self.current_execution:
                await self._send_to_client(websocket, self.current_execution)
            else:
                await self._send_to_client(websocket, {
                    'type': 'chain_progress',
                    'data': {
                        'isExecuting': False,
                        'chainId': None,
                        'chainName': None,
                        'executionId': None,
                        'currentWorkflowIndex': None,
                        'workflows': [],
                        'timestamp': datetime.now().isoformat()
                    }
                })

    async def remove_client(self, websocket):
        """Remove a WebSocket client"""
        async with self.lock:
            self.clients.discard(websocket)

    async def start_chain_execution(
        self,
        chain_id: str,
        chain_name: str,
        execution_id: str,
        workflow_nodes: List[Dict[str, Any]]
    ):
        """Start a new chain execution"""
        async with self.lock:
            # Clear any previous completed execution state
            # New execution will replace it
            workflows = [
                {
                    'index': idx,
                    'id': node.get('id'),
                    'name': node.get('name', 'Unnamed'),
                    'status': 'pending'  # pending, waiting, running, completed, failed
                }
                for idx, node in enumerate(workflow_nodes)
            ]

            self.current_execution = {
                'type': 'chain_progress',
                'data': {
                    'isExecuting': True,
                    'chainId': chain_id,
                    'chainName': chain_name,
                    'executionId': execution_id,
                    'currentWorkflowIndex': 0,
                    'workflows': workflows,
                    'timestamp': datetime.now().isoformat()
                }
            }

            await self._broadcast(self.current_execution)

    async def update_workflow_status(
        self,
        workflow_index: int,
        status: str,
        error: Optional[str] = None
    ):
        """Update the status of a specific workflow"""
        async with self.lock:
            if not self.current_execution:
                return

            workflows = self.current_execution['data']['workflows']
            if 0 <= workflow_index < len(workflows):
                workflows[workflow_index]['status'] = status
                if error:
                    workflows[workflow_index]['error'] = error

            # Update current workflow index
            if status == 'running':
                self.current_execution['data']['currentWorkflowIndex'] = workflow_index
            elif status == 'completed' and workflow_index < len(workflows) - 1:
                self.current_execution['data']['currentWorkflowIndex'] = workflow_index + 1

            self.current_execution['data']['timestamp'] = datetime.now().isoformat()

            await self._broadcast(self.current_execution)

    async def complete_chain_execution(self, success: bool, error: Optional[str] = None):
        """Mark chain execution as completed"""
        async with self.lock:
            if not self.current_execution:
                return

            final_message = {
                'type': 'chain_progress',
                'data': {
                    'isExecuting': False,
                    'chainId': self.current_execution['data']['chainId'],
                    'chainName': self.current_execution['data']['chainName'],
                    'executionId': self.current_execution['data']['executionId'],
                    'currentWorkflowIndex': None,
                    'workflows': self.current_execution['data']['workflows'],
                    'completed': True,
                    'success': success,
                    'error': error,
                    'timestamp': datetime.now().isoformat()
                }
            }

            await self._broadcast(final_message)

            # Clear current execution after broadcasting completion
            self.current_execution = None

    async def _broadcast(self, message: Dict[str, Any]):
        """Broadcast message to all connected clients"""
        if not self.clients:
            return

        message_json = json.dumps(message)

        # Send to all clients, remove disconnected ones
        disconnected = set()
        for client in self.clients:
            try:
                await client.send_str(message_json)
            except Exception as e:
                print(f"[ChainProgressManager] Failed to send to client: {e}")
                disconnected.add(client)

        # Remove disconnected clients
        for client in disconnected:
            self.clients.discard(client)

    async def _send_to_client(self, client, message: Dict[str, Any]):
        """Send message to a specific client"""
        try:
            message_json = json.dumps(message)
            await client.send_str(message_json)
        except Exception as e:
            print(f"[ChainProgressManager] Failed to send to client: {e}")

    async def send_current_state(self, websocket):
        """Send current execution state to a specific client"""
        async with self.lock:
            if self.current_execution:
                await self._send_to_client(websocket, self.current_execution)
            else:
                await self._send_to_client(websocket, {
                    'type': 'chain_progress',
                    'data': {
                        'isExecuting': False,
                        'chainId': None,
                        'chainName': None,
                        'executionId': None,
                        'currentWorkflowIndex': None,
                        'workflows': [],
                        'timestamp': datetime.now().isoformat()
                    }
                })

    def get_current_state(self) -> Dict[str, Any]:
        """Get current execution state"""
        if self.current_execution:
            return self.current_execution['data']
        else:
            return {
                'isExecuting': False,
                'chainId': None,
                'chainName': None,
                'executionId': None,
                'currentWorkflowIndex': None,
                'workflows': [],
                'timestamp': datetime.now().isoformat()
            }


# Global singleton instance
chain_progress_manager = ChainProgressManager()
