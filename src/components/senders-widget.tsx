// src/components/senders-widget.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { Button, Input, Listbox, ListboxItem, Chip, Spinner, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from '@heroui/react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import type { Database } from '@/types/supabase';

type Sender = Database['public']['Tables']['senders']['Row'];

// Re-usable fetcher for useSWR
const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'An unknown error occurred.' }));
    throw new Error(errorBody.error || errorBody.message || 'Failed to fetch data.');
  }
  return response.json();
};

export const SendersWidget: React.FC = () => {
  const { data: senders, error, isLoading, mutate } = useSWR<Sender[]>('/api/senders', fetcher, {
    refreshInterval: 10000, // Refresh senders list every 10 seconds
  });

  const { isOpen: isAddModalOpen, onOpen: onAddModalOpen, onClose: onAddModalClose } = useDisclosure();
  const { isOpen: isDeleteConfirmOpen, onOpen: onDeleteConfirmOpen, onClose: onDeleteConfirmClose } = useDisclosure();

  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderName, setNewSenderName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [senderToDelete, setSenderToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddSender = async () => {
    if (!newSenderEmail || !newSenderName) {
      toast.error('Email and Name are required.');
      return;
    }

    setIsAdding(true);
    const addToastId = toast.loading('Adding sender...');
    try {
      const response = await fetch('/api/senders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_email: newSenderEmail, sender_name: newSenderName }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to add sender.');
      }

      toast.success('Sender added successfully!', { id: addToastId });
      setNewSenderEmail('');
      setNewSenderName('');
      mutate(); // Revalidate SWR cache to update the list
      onAddModalClose();
    } catch (err: any) {
      toast.error(err.message, { id: addToastId });
    } finally {
      setIsAdding(false);
    }
  };

  const confirmDeleteSender = useCallback((senderId: string) => {
    setSenderToDelete(senderId);
    onDeleteConfirmOpen();
  }, [onDeleteConfirmOpen]);

  const handleDeleteSender = async () => {
    if (!senderToDelete) return;

    setIsDeleting(true);
    const deleteToastId = toast.loading('Deleting sender...');
    try {
      const response = await fetch(`/api/senders?id=${senderToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete sender.');
      }

      toast.success('Sender deleted successfully!', { id: deleteToastId });
      mutate(); // Revalidate SWR cache
      onDeleteConfirmClose();
      setSenderToDelete(null);
    } catch (err: any) {
      toast.error(err.message, { id: deleteToastId });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Spinner label="Loading senders..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-danger">
        Error: {error.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-2 space-y-4">
      <h3 className="text-sm font-medium">Email Senders ({senders?.length || 0})</h3>
      
      <div className="flex-grow overflow-y-auto custom-scrollbar">
        {senders && senders.length > 0 ? (
          <Listbox
            aria-label="Email Senders"
            items={senders}
            className="p-0 gap-0 divide-y divide-default-200 border border-default-200 rounded-medium"
            itemClasses={{
              base: "px-3 py-2 text-small",
            }}
          >
            {(item: Sender) => (
              <ListboxItem key={item.id} textValue={item.sender_email}>
                <div className="flex justify-between items-center w-full">
                  <div className="flex flex-col">
                    <span className="font-medium">{item.sender_name}</span>
                    <span className="text-xs text-default-500">{item.sender_email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.is_active ? (
                        <Chip color="success" size="sm" variant="flat">Active</Chip>
                    ) : (
                        <Chip color="default" size="sm" variant="flat">Inactive</Chip>
                    )}
                    <Button 
                      isIconOnly 
                      size="sm" 
                      variant="light" 
                      color="danger" 
                      onPress={() => confirmDeleteSender(item.id)}
                    >
                      <Icon icon="lucide:trash-2" className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </ListboxItem>
            )}
          </Listbox>
        ) : (
          <p className="text-default-500 text-center py-4">No senders configured yet.</p>
        )}
      </div>

      <Button color="primary" onPress={onAddModalOpen} startContent={<Icon icon="lucide:plus" className="w-4 h-4" />}>
        Add New Sender
      </Button>

      {/* Add Sender Modal */}
      <Modal isOpen={isAddModalOpen} onClose={onAddModalClose}>
        <ModalContent>
          <ModalHeader>Add New Email Sender</ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="Sender Name"
              placeholder="e.g., John Doe"
              value={newSenderName}
              onValueChange={setNewSenderName}
              isRequired
            />
            <Input
              label="Sender Email"
              placeholder="e.g., john.doe@example.com"
              type="email"
              value={newSenderEmail}
              onValueChange={setNewSenderEmail}
              isRequired
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onAddModalClose} disabled={isAdding}>Cancel</Button>
            <Button color="primary" onPress={handleAddSender} isLoading={isAdding}>
              {isAdding ? 'Adding...' : 'Add Sender'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteConfirmOpen} onClose={onDeleteConfirmClose}>
        <ModalContent>
          <ModalHeader>Confirm Deletion</ModalHeader>
          <ModalBody>
            Are you sure you want to delete this sender? This action cannot be undone.
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteConfirmClose} disabled={isDeleting}>Cancel</Button>
            <Button color="danger" onPress={handleDeleteSender} isLoading={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};